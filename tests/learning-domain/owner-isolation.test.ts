// 匿名 owner 隔离测试：x-trellis-owner-id header 解析 + 多 owner 状态互不串扰
import test from "node:test";
import assert from "node:assert/strict";

import {
  ownerOf,
  DEFAULT_OWNER,
  requireCourseIntelligenceAdmin,
} from "../../app/api/learning/_shared.ts";
import {
  LearningApplicationService,
} from "../../lib/learning/application/learning-service.ts";
import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";
import { createRuleAgents } from "../../lib/learning/agents/index.ts";

function createService() {
  return new LearningApplicationService(
    new InMemoryLearningStore(),
    createRuleAgents(),
  );
}

// ── ownerOf：header 优先，无/非法回退 DEFAULT_OWNER ──
test("ownerOf 本地开发允许 x-trellis-owner-id", async () => {
  const id = "aaaabbbb-1111-2222-3333-444455556666";
  const req = new Request("http://localhost/api/learning/workspace", {
    headers: { "x-trellis-owner-id": id },
  });
  assert.equal(await ownerOf(req), id);
});

test("ownerOf 本地无 header 回退 DEFAULT_OWNER", async () => {
  const req = new Request("http://localhost/api/learning/workspace");
  assert.equal(await ownerOf(req), DEFAULT_OWNER);
});

test("ownerOf 本地非法格式回退 DEFAULT_OWNER", async () => {
  for (const bad of ["short", "a".repeat(200), "bad id!", "select*from", ""]) {
    const req = new Request("http://localhost/api/learning/workspace", {
      headers: { "x-trellis-owner-id": bad },
    });
    assert.equal(await ownerOf(req), DEFAULT_OWNER, `header=${JSON.stringify(bad)} 应回退`);
  }
});

test("ownerOf 本机模拟托管身份时隐藏原始邮箱", async () => {
  const first = await ownerOf(new Request("http://localhost", { headers: {
    "oai-authenticated-user-email": "Learner@Example.com",
    "x-trellis-owner-id": "anonymous-owner-123",
  } }));
  const second = await ownerOf(new Request("http://localhost", { headers: {
    "oai-authenticated-user-email": "learner@example.com",
  } }));
  assert.equal(first, second);
  assert.match(first, /^chatgpt-[0-9a-f]{32}$/);
  assert.equal(first.includes("learner"), false);
});

test("ownerOf 生产请求不信任客户端伪造的托管邮箱", async () => {
  const request = new Request("https://trellis.example/api/learning/current", {
    headers: { "oai-authenticated-user-email": "spoofed@example.com" },
  });
  await assert.rejects(ownerOf(request), /ChatGPT 登录/);
});

test("ownerOf 生产请求拒绝客户端自报 owner", async () => {
  const request = new Request("https://trellis.example/api/learning/current", {
    headers: { "x-trellis-owner-id": "spoofed-owner-123" },
  });
  await assert.rejects(ownerOf(request), /ChatGPT 登录/);
});

test("内部评审本地也必须显式声明管理员请求", async () => {
  const ordinary = new Request("http://127.0.0.1/api/internal/course-intelligence/candidates");
  await assert.rejects(requireCourseIntelligenceAdmin(ordinary), /评审权限/);
  const admin = new Request("http://127.0.0.1/api/internal/course-intelligence/candidates", {
    headers: {
      "x-trellis-admin": "true",
      "x-trellis-owner-id": "local-reviewer-owner",
    },
  });
  assert.equal(await requireCourseIntelligenceAdmin(admin), "local-reviewer-owner");
});

// ── 多 owner 状态隔离（service 层）───────────────────
const OWNER_A = "owner-a-aaaa";
const OWNER_B = "owner-b-bbbb";

test("两个 owner 诊断后 workspace 不互串", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER_A, goal: "A 的目标", weeklyMinutes: 180 });
  const wsA = await service.getWorkspace(OWNER_A);
  const wsB = await service.getWorkspace(OWNER_B);
  assert.ok(wsA.profile, "A 应有画像");
  assert.equal(wsB.profile, null, "B 不应看到 A 的画像");
  assert.equal(wsB.nodeProgress.length, 0, "B 不应有 A 的节点进度");
});

test("confirm 后 A 的周计划不影响 B", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER_A, goal: "A 的目标", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER_A);
  const wsA = await service.getWorkspace(OWNER_A);
  const wsB = await service.getWorkspace(OWNER_B);
  assert.ok(wsA.weeklyPlan, "A 应有周计划");
  assert.equal(wsB.weeklyPlan, null, "B 不应看到 A 的周计划");
  assert.equal(wsB.activities.length, 0, "B 不应看到 A 的活动");
});

test("reset 只清当前 owner", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER_A, goal: "A 的目标", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER_A);
  await service.runDiagnostic({ ownerId: OWNER_B, goal: "B 的目标", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER_B);
  await service.resetLearner(OWNER_A);
  const wsA = await service.getWorkspace(OWNER_A);
  const wsB = await service.getWorkspace(OWNER_B);
  assert.equal(wsA.profile, null, "A 应被清空回诊断");
  assert.ok(wsB.profile, "B 不应受影响");
  assert.ok(wsB.weeklyPlan, "B 的周计划应保留");
});

test("replan 只重排当前 owner", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER_A, goal: "A 的目标", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER_A);
  await service.runDiagnostic({ ownerId: OWNER_B, goal: "B 的目标", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER_B);
  const beforeB = await service.getWorkspace(OWNER_B);
  await service.replanCurrentWeek(OWNER_A);
  const afterB = await service.getWorkspace(OWNER_B);
  assert.deepEqual(
    afterB.activities.map((a) => a.id),
    beforeB.activities.map((a) => a.id),
    "B 的活动不应因 A 重排而变化",
  );
  assert.equal(
    afterB.adjustments.length,
    beforeB.adjustments.length,
    "B 不应出现 A 的 activity_replan 调整记录",
  );
  const afterA = await service.getWorkspace(OWNER_A);
  assert.ok(afterA.adjustments.some((a) => a.adjustmentType === "activity_replan"),
    "A 应有 activity_replan 记录");
});

// 内容模型测试：节点 ID 唯一、三条路线、前置合法、相邻分支
import test from "node:test";
import assert from "node:assert/strict";

import {
  learningContentPack,
  validateContentPack,
  findAdjacentBranches,
  getPrerequisiteNodeIds,
  prerequisitesSatisfied,
} from "../../lib/learning/domain/content.ts";

test("内容包校验通过（无重复、无环、引用合法）", () => {
  assert.doesNotThrow(() => validateContentPack(learningContentPack));
});

test("节点 ID 唯一", () => {
  const ids = learningContentPack.nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("三条路线存在", () => {
  const routeIds = learningContentPack.routes.map((r) => r.id);
  assert.ok(routeIds.includes("ai-literacy"));
  assert.ok(routeIds.includes("ai-app-dev"));
  assert.ok(routeIds.includes("ai-product"));
});

test("前置关系合法：引用的节点都存在", () => {
  const nodeIds = new Set(learningContentPack.nodes.map((n) => n.id));
  for (const edge of learningContentPack.edges) {
    assert.ok(nodeIds.has(edge.sourceNodeId), `源节点不存在: ${edge.sourceNodeId}`);
    assert.ok(nodeIds.has(edge.targetNodeId), `目标节点不存在: ${edge.targetNodeId}`);
  }
});

test("前置关系无环", () => {
  // 内容包校验已含无环检查；这里再验证机制
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const prereqs = (id: string) =>
    learningContentPack.edges
      .filter((e) => e.relationType === "prerequisite" && e.targetNodeId === id)
      .map((e) => e.sourceNodeId);
  const visit = (id: string) => {
    assert.ok(!visiting.has(id), `检测到环，涉及节点 ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const p of prereqs(id)) visit(p);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of learningContentPack.nodes) visit(node.id);
});

test("当前路线能找到相邻分支", () => {
  // AI 应用开发 ↔ AI 产品经理有 related 边
  const adjacentForAppDev = findAdjacentBranches("ai-app-dev");
  assert.ok(adjacentForAppDev.length >= 1, "ai-app-dev 应有相邻分支");
  assert.ok(
    adjacentForAppDev.some((b) => b.routeId === "ai-product"),
    "ai-app-dev 的相邻分支应包含 ai-product",
  );
  // 通识主干是共同起点：V0.2 产品上它能看到所有分支（ai-app-dev / ai-product）
  const adjacentForLiteracy = findAdjacentBranches("ai-literacy");
  assert.ok(
    adjacentForLiteracy.length >= 2,
    `ai-literacy 应展示所有相邻分支（app-dev + product），实际 ${adjacentForLiteracy.length}`,
  );
  assert.ok(
    adjacentForLiteracy.some((b) => b.routeId === "ai-app-dev") &&
      adjacentForLiteracy.some((b) => b.routeId === "ai-product"),
    "ai-literacy 相邻分支应包含 ai-app-dev 与 ai-product",
  );
});

test("前置查询与满足判断", () => {
  const prereqs = getPrerequisiteNodeIds("ai-literacy.architecture");
  assert.ok(prereqs.includes("ai-literacy.fit"));
  assert.ok(prereqs.includes("ai-literacy.context"));

  // 前置未满足时返回 false
  assert.equal(
    prerequisitesSatisfied("ai-literacy.architecture", {
      "ai-literacy.fit": "unstarted",
      "ai-literacy.context": "growing",
    }),
    false,
  );
  // 前置全部 validated 时返回 true
  assert.equal(
    prerequisitesSatisfied("ai-literacy.architecture", {
      "ai-literacy.fit": "validated",
      "ai-literacy.context": "validated",
    }),
    true,
  );
});

test("内容包节点字段完整（outcomes/sourceRefs/模板/量规）", () => {
  const pack = learningContentPack;
  assert.ok(pack.nodes.length >= 6, `至少 6 个节点，实际 ${pack.nodes.length}`);
  for (const node of pack.nodes) {
    assert.ok(node.moduleId, `${node.id} 有 moduleId`);
    assert.ok(node.titleEn, `${node.id} 有 titleEn`);
    assert.ok(node.outcomes.length >= 1, `${node.id} 有 outcomes`);
    assert.ok(node.sourceRefs.length >= 1, `${node.id} 有 sourceRefs`);
    for (const ref of node.sourceRefs) {
      assert.match(ref.url, /^https?:\/\//, `${node.id} sourceRef 可点击: ${ref.url}`);
    }
    assert.ok(node.activityTemplates.length >= 1, `${node.id} 有活动模板`);
    assert.ok(node.assessmentRubric.trim().length > 0, `${node.id} 有评估量规`);
  }
  // ai-literacy 至少 6 个中文节点（内容样本要求）
  const literacyNodes = pack.nodes.filter((n) => n.routeId === "ai-literacy");
  assert.ok(literacyNodes.length >= 6, `ai-literacy 至少 6 节点，实际 ${literacyNodes.length}`);
  // 中文标题优先（内容包工程要求：不再大面积英文）
  for (const node of literacyNodes) {
    assert.ok(/[\u4e00-\u9fff]/.test(node.title), `${node.id} 中文标题: ${node.title}`);
  }
});

test("内置资源映射包含课程片段判断字段", () => {
  for (const mapping of learningContentPack.resourceMappings) {
    assert.ok(mapping.segmentFocus?.trim(), `${mapping.resourceId}:${mapping.nodeId} 有建议片段`);
    assert.ok(mapping.qualityRationale?.trim(), `${mapping.resourceId}:${mapping.nodeId} 有专业性依据`);
    assert.ok(mapping.skipGuidance?.trim(), `${mapping.resourceId}:${mapping.nodeId} 有暂时跳过范围`);
    assert.ok(mapping.learnerAction?.trim(), `${mapping.resourceId}:${mapping.nodeId} 有看完后的学习动作`);
  }
});

test("内容包校验：缺失字段抛错", () => {
  const pack = structuredClone(learningContentPack);
  const bad = pack.nodes[0];
  bad.outcomes = [];
  assert.throws(() => validateContentPack(pack), /outcomes/);
  bad.outcomes = ["ok"];
  bad.sourceRefs = [{ label: "x", url: "not-a-url" }];
  assert.throws(() => validateContentPack(pack), /sourceRef/);
  bad.sourceRefs = [{ label: "x", url: "https://example.com" }];
  bad.activityTemplates = ["not-a-template"];
  assert.throws(() => validateContentPack(pack), /未知活动模板/);
  bad.activityTemplates = ["build_model"];
  bad.assessmentRubric = "";
  assert.throws(() => validateContentPack(pack), /assessmentRubric/);
});

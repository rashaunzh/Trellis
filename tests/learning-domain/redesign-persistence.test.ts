import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { D1CourseIntelligenceRepository } from "../../lib/learning/intelligence/repository.ts";
import { D1LearningStore } from "../../lib/learning/persistence/d1.ts";
import { CourseIntelligenceModelGateway } from "../../lib/learning/intelligence/model-gateway.ts";
import { CourseIntelligenceService } from "../../lib/learning/intelligence/service.ts";

// 执行真实仓库 SQL 的本地适配器；不声称模拟 D1 的跨进程一致性。
function localD1(sqlite: DatabaseSync) {
  const prepare = (sql: string, values: Array<string | number | null> = []) => ({
    bind: (...next: Array<string | number | null>) => prepare(sql, next),
    async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...values), success: true }; },
    async run() { return { success: true, meta: sqlite.prepare(sql).run(...values) }; },
    execute() { return { success: true, meta: sqlite.prepare(sql).run(...values) }; },
  });
  return {
    prepare,
    async batch(statements: Array<ReturnType<typeof prepare>>) {
      sqlite.exec("BEGIN");
      try { const results = statements.map(statement => statement.execute()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
}
test("真实SQLite：反馈重试、owner隔离、重开恢复与拒绝旧方案", async () => {
  const directory = mkdtempSync(join(tmpdir(), "trellis-redesign-"));
  let sqlite = new DatabaseSync(join(directory, "state.sqlite"));
  const owner = "redesign-persistence";
  try {
    const manifest = JSON.parse(readFileSync("drizzle/migration-manifest.json", "utf8"));
    for (const file of manifest.files) sqlite.exec(readFileSync(join("drizzle", file), "utf8"));
    function connect() {
      const db = localD1(sqlite);
      const repository = new D1CourseIntelligenceRepository(db);
      const store = new D1LearningStore(db);
      return { repository, store, service: new CourseIntelligenceService(repository, new CourseIntelligenceModelGateway(repository, null), store) };
    }
    let env = connect();
    await env.store.seedContent(); await env.service.initialize();
    const route = await env.service.createCurriculum(owner, { goal: "理解AI产品能力边界", weeklyCapacity: "light", materials: [] });
    await env.service.confirmCurriculum(owner, route.id);
    const initial = await env.service.getCurrentLearning(owner);
    const activityId = initial.activities[0]!.id;
    const signal = { submissionId: "response-lost", type: "understanding", value: "uncertain", completionIntent: "keep_open", note: "尚不能说明人工兜底" };
    const first = await env.service.recordLearningSignal(owner, activityId, signal);
    await env.service.updateActivityLocation(owner, activityId, { sourceUrl: "https://redesign.invalid/unit", locatorLabel: "第二节" });
    const before = await env.service.getCurrentLearning(owner);
    sqlite.close(); sqlite = new DatabaseSync(join(directory, "state.sqlite")); env = connect();
    const retry = await env.service.recordLearningSignal(owner, activityId, signal);
    assert.equal(retry.signal.id, first.signal.id);
    assert.equal((await env.repository.listLearningSignals(owner, route.id)).length, 1);
    const after = await env.service.getCurrentLearning(owner);
    assert.deepEqual(after.activities, before.activities);
    assert.equal((await env.service.getLearningTaskResult(owner, activityId)).taskId, activityId);
    assert.match((await env.service.getLearningTaskResult(owner, activityId)).submittedSignal.summary, /尚不能说明人工兜底/);
    await assert.rejects(env.service.getLearningTaskResult("different-owner", activityId), /不存在/);
    await assert.rejects(env.service.recordLearningSignal("different-owner", activityId, signal), /不存在/);
    const selected = route.assembly.decisions.find(item => item.selectedUnitIds.length)!;
    const proposed = await env.service.reviseCurriculum(owner, route.id, [{ type: "exclude_course", courseId: selected.courseId }]);
    assert.equal((await env.service.getCurrentLearning(owner)).curriculum?.id, route.id);
    await env.service.rejectDecision(owner, proposed.decision.id);
    await assert.rejects(env.service.confirmCurriculum(owner, proposed.curriculum.id), /拒绝|替代/);
    assert.equal((await env.service.getCurrentLearning(owner)).curriculum?.id, route.id);
    const saveActivity = env.store.saveActivity.bind(env.store);
    env.store.saveActivity = async () => { throw new Error("injected activity write failure"); };
    const interrupted = { ...signal, submissionId: "database-interrupted", note: "数据库中断恢复样例" };
    await assert.rejects(env.service.recordLearningSignal(owner, activityId, interrupted), /injected/);
    assert.equal((await env.repository.listLearningSignals(owner, route.id)).length, 2, "反馈已入库，行动投影尚未写完");
    env.store.saveActivity = saveActivity;
    const recovered = await env.service.recordLearningSignal(owner, activityId, interrupted);
    assert.equal((await env.repository.listLearningSignals(owner, route.id)).length, 2, "恢复不能重复新增反馈");
    assert.equal((await env.store.getActivity(activityId))?.scope?.lastFeedbackSignalId, recovered.signal.id);
    await env.service.recordLearningSignal(owner, activityId, signal);
    assert.equal((await env.store.getActivity(activityId))?.scope?.lastFeedbackSignalId, recovered.signal.id, "旧提交重试不得覆盖新结果");
    const nextWeek = await env.service.closeWeek(owner, initial.weeklyPlan!.weekKey);
    assert.ok(nextWeek);
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true });
  }
});

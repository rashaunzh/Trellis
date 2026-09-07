import {
  curriculumAssemblySchema,
  curriculumRecordStatusSchema,
  courseGenomeSchema,
  domainGraphSchema,
  learningIntakeSchema,
  publishedCourseSchema,
  trustedSourceSchema,
  unitNodeMappingSchema,
  type CurriculumRecord,
  type CanonicalKnowledgeState,
  type CourseCandidateRecord,
  type DomainGraph,
  type LearningSignal,
  type PublishedCourse,
  type TrustedSource,
} from "./course-intelligence.ts";
import {
  baselineCourses,
  baselineMappingsFor,
  publishedDomainGraph,
  trustedSources,
} from "./baseline.ts";
import {
  decisionEventSchema,
  decisionRecordSchema,
  type DecisionEvent,
  type DecisionRecord,
  type DecisionStatus,
} from "./decision-kernel.ts";
import type { ContentAnalysis, ContentSource } from "./content-source.ts";

function analysisRunFromRow(row: Record<string, unknown>): AnalysisRunRecord {
  return {
    id: String(row.id), ownerId: row.owner_id ? String(row.owner_id) : null, kind: String(row.kind), inputHash: String(row.input_hash),
    provider: String(row.provider), model: String(row.model), status: row.status as AnalysisRunRecord["status"],
    outputJson: String(row.output_json), error: String(row.error), promptTokens: Number(row.prompt_tokens),
    completionTokens: Number(row.completion_tokens), latencyMs: Number(row.latency_ms), createdAt: String(row.created_at),
    requestId: row.request_id ? String(row.request_id) : String(row.id), workflowRunId: row.workflow_run_id ? String(row.workflow_run_id) : null,
    decisionId: row.decision_id ? String(row.decision_id) : null, slot: (row.slot ? String(row.slot) : "primary") as AnalysisRunRecord["slot"],
    attempt: Number(row.attempt ?? 1), contractVersion: String(row.contract_version ?? "legacy"),
    failureClass: String(row.failure_class ?? ""), fallbackReason: String(row.fallback_reason ?? ""),
    cacheHit: Boolean(row.cache_hit), evalJson: String(row.eval_json ?? "{}"),
  };
}

export interface AnalysisRunRecord {
  id: string;
  ownerId: string | null;
  kind: string;
  inputHash: string;
  provider: string;
  model: string;
  status: "success" | "failed" | "needs_review";
  outputJson: string;
  error: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  createdAt: string;
  requestId?: string;
  workflowRunId?: string | null;
  decisionId?: string | null;
  slot?: "primary" | "fallback" | "baseline";
  attempt?: number;
  contractVersion?: string;
  failureClass?: string;
  fallbackReason?: string;
  cacheHit?: boolean;
  evalJson?: string;
}

export interface AnalysisRunFilter {
  requestId?: string;
  ownerId?: string;
  limit?: number;
}

export interface WorkflowRunRecord {
  id: string;
  ownerId: string;
  workflowId: string;
  aggregateType: "curriculum" | "course_candidate" | "learning_activity" | "source";
  aggregateId: string;
  status: "running" | "suspended" | "completed" | "failed" | "cancelled";
  currentStep: string;
  lastError: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateReviewRecord {
  id: string;
  candidateId: string;
  reviewerOwnerId: string;
  decision: "validated" | "rejected" | "published" | "rolled_back";
  reason: string;
  reviewJson: string;
  createdAt: string;
}

export interface SourceSnapshotCandidate {
  id: string;
  sourceId: string;
  contentHash: string;
  retrievedAt: string;
  contentJson: string;
}

export interface SourceUpdateJobRecord {
  id: string;
  sourceId: string;
  status: "candidate" | "unchanged";
  previousSnapshotId: string | null;
  candidateSnapshotId: string | null;
  impactJson: string;
  error: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseIntelligenceRepository {
  seedPublishedBaseline(): Promise<void>;
  listSources(): Promise<TrustedSource[]>;
  listSourcesDue(limit: number, now: string): Promise<TrustedSource[]>;
  markSourceCheckFailed(sourceId: string, error: string, checkedAt: string): Promise<void>;
  saveSourceUpdateCandidate(snapshot: SourceSnapshotCandidate): Promise<SourceUpdateJobRecord>;
  listCourses(): Promise<PublishedCourse[]>;
  listAvailableCourses(ownerId: string): Promise<PublishedCourse[]>;
  getPublishedGraph(): Promise<DomainGraph>;
  getCurriculum(id: string, ownerId: string): Promise<CurriculumRecord | null>;
  getLatestCurriculum(ownerId: string, status?: "confirmed"): Promise<CurriculumRecord | null>;
  listCurriculaUsingCourse(courseId: string): Promise<CurriculumRecord[]>;
  saveCurriculum(record: CurriculumRecord): Promise<void>;
  saveCourseCandidate(candidate: CourseCandidateRecord): Promise<void>;
  getCourseCandidate(id: string): Promise<CourseCandidateRecord | null>;
  listCourseCandidates(status?: CourseCandidateRecord["status"]): Promise<CourseCandidateRecord[]>;
  reviewCourseCandidate(candidateId: string, review: CandidateReviewRecord): Promise<void>;
  publishCourseCandidate(candidateId: string, course: PublishedCourse, review?: CandidateReviewRecord): Promise<void>;
  saveWorkflowRun(run: WorkflowRunRecord): Promise<void>;
  getWorkflowRunByAggregate(ownerId: string, aggregateId: string): Promise<WorkflowRunRecord | null>;
  getWorkflowRun(id: string, ownerId: string): Promise<WorkflowRunRecord | null>;
  saveDecision(decision: DecisionRecord, event?: DecisionEvent): Promise<void>;
  getDecision(id: string, ownerId: string): Promise<DecisionRecord | null>;
  listDecisions(ownerId: string, statuses?: DecisionStatus[]): Promise<DecisionRecord[]>;
  listDecisionEvents(decisionId: string): Promise<DecisionEvent[]>;
  resetOwnerState(ownerId: string): Promise<void>;
  supersedeCurricula(ownerId: string, exceptId: string, includeConfirmed?: boolean): Promise<void>;
  saveLearningSignal(signal: LearningSignal, state: CanonicalKnowledgeState): Promise<void>;
  listLearningSignals(ownerId: string, curriculumId?: string): Promise<LearningSignal[]>;
  listKnowledgeStates(ownerId: string): Promise<CanonicalKnowledgeState[]>;
  findCachedAnalysis(kind: string, inputHash: string, model: string): Promise<AnalysisRunRecord | null>;
  getAnalysisUsageSince(ownerId: string, since: string): Promise<{ calls: number; tokens: number }>;
  saveAnalysisRun(run: AnalysisRunRecord): Promise<void>;
  listAnalysisRuns(filter?: AnalysisRunFilter): Promise<AnalysisRunRecord[]>;
  linkAnalysisRuns(workflowRunId: string, decisionId: string): Promise<void>;
  saveContentSource(source: ContentSource): Promise<void>;
  getContentSource(id: string, ownerId: string): Promise<ContentSource | null>;
  listContentSources(ownerId: string): Promise<ContentSource[]>;
  saveContentAnalysis(analysis: ContentAnalysis): Promise<void>;
  getLatestContentAnalysis(sourceId: string): Promise<ContentAnalysis | null>;
  confirmContentFragments(sourceId: string, ownerId: string, fragmentIds: string[], decision: "confirmed" | "rejected"): Promise<ContentAnalysis>;
}

export class InMemoryCourseIntelligenceRepository implements CourseIntelligenceRepository {
  private curricula = new Map<string, CurriculumRecord>();
  private runs = new Map<string, AnalysisRunRecord>();
  private signals = new Map<string, LearningSignal>();
  private knowledgeStates = new Map<string, CanonicalKnowledgeState>();
  private candidates = new Map<string, CourseCandidateRecord>();
  private publishedCourses = new Map<string, PublishedCourse>();
  private workflowRuns = new Map<string, WorkflowRunRecord>();
  private candidateReviews = new Map<string, CandidateReviewRecord>();
  private sourceSnapshots = new Map<string, SourceSnapshotCandidate>();
  private decisions = new Map<string, DecisionRecord>();
  private decisionEvents = new Map<string, DecisionEvent>();
  private contentSources = new Map<string, ContentSource>();
  private contentAnalyses = new Map<string, ContentAnalysis>();

  async seedPublishedBaseline() {}
  async listSources() { return structuredClone(trustedSources); }
  async listSourcesDue(limit: number) { return structuredClone(trustedSources.slice(0, limit)); }
  async markSourceCheckFailed() {}
  async saveSourceUpdateCandidate(snapshot: SourceSnapshotCandidate): Promise<SourceUpdateJobRecord> {
    const previous = Array.from(this.sourceSnapshots.values())
      .filter((item) => item.sourceId === snapshot.sourceId)
      .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt))[0] ?? null;
    const unchanged = previous?.contentHash === snapshot.contentHash;
    if (!unchanged) this.sourceSnapshots.set(snapshot.id, structuredClone(snapshot));
    return {
      id: `source-job.${crypto.randomUUID()}`,
      sourceId: snapshot.sourceId,
      status: unchanged ? "unchanged" : "candidate",
      previousSnapshotId: previous?.id ?? null,
      candidateSnapshotId: unchanged ? null : snapshot.id,
      impactJson: JSON.stringify({ changed: !unchanged, requiresReview: !unchanged }),
      error: "",
      createdAt: snapshot.retrievedAt,
      updatedAt: snapshot.retrievedAt,
    };
  }
  async listCourses(): Promise<PublishedCourse[]> {
    const mappings = baselineMappingsFor();
    return [...baselineCourses.map((item) => ({
      genome: structuredClone(item.genome),
      tags: [...item.tags],
      mappings: mappings.filter((mapping) => mapping.courseId === item.genome.id),
    })), ...Array.from(this.publishedCourses.values()).map((item) => structuredClone(item))];
  }
  async listAvailableCourses(ownerId: string): Promise<PublishedCourse[]> {
    const shared = await this.listCourses();
    const personal = Array.from(this.candidates.values())
      .filter((item) => item.ownerId === ownerId && item.status === "personal_ready")
      .flatMap((item) => {
        try { return [publishedCourseSchema.parse(JSON.parse(item.candidateJson ?? "{}"))]; }
        catch { return []; }
      });
    return [...shared, ...personal];
  }
  async getPublishedGraph() { return publishedDomainGraph; }
  async getCurriculum(id: string, ownerId: string) {
    const record = this.curricula.get(id);
    return record?.ownerId === ownerId ? structuredClone(record) : null;
  }
  async getLatestCurriculum(ownerId: string, status?: "confirmed") {
    return Array.from(this.curricula.values())
      .filter((item) => item.ownerId === ownerId && item.status !== "superseded" && (!status || item.status === status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  }
  async listCurriculaUsingCourse(courseId: string) {
    return Array.from(this.curricula.values()).filter((record) =>
      record.status === "confirmed" && record.assembly.decisions.some((decision) => decision.courseId === courseId));
  }
  async saveCurriculum(record: CurriculumRecord) { this.curricula.set(record.id, structuredClone(record)); }
  async saveCourseCandidate(candidate: CourseCandidateRecord) { this.candidates.set(candidate.id, structuredClone(candidate)); }
  async getCourseCandidate(id: string) { return structuredClone(this.candidates.get(id) ?? null); }
  async listCourseCandidates(status?: CourseCandidateRecord["status"]) {
    return Array.from(this.candidates.values())
      .filter((item) => !status || item.status === status)
      .map((item) => structuredClone(item));
  }
  async reviewCourseCandidate(candidateId: string, review: CandidateReviewRecord) {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) throw new Error("课程候选不存在");
    candidate.status = review.decision === "validated" ? "validated" : "rejected";
    candidate.updatedAt = review.createdAt;
    this.candidates.set(candidateId, candidate);
    this.candidateReviews.set(review.id, structuredClone(review));
  }
  async publishCourseCandidate(candidateId: string, course: PublishedCourse, review?: CandidateReviewRecord) {
    const candidate = this.candidates.get(candidateId);
    if (!candidate || !["candidate", "validated"].includes(candidate.status)) throw new Error("课程候选不存在或不可发布");
    candidate.status = "published";
    candidate.updatedAt = new Date().toISOString();
    this.candidates.set(candidateId, candidate);
    this.publishedCourses.set(course.genome.id, structuredClone(course));
    if (review) this.candidateReviews.set(review.id, structuredClone(review));
  }
  async supersedeCurricula(ownerId: string, exceptId: string, includeConfirmed = false) {
    for (const record of this.curricula.values()) {
      if (record.ownerId === ownerId && record.id !== exceptId && (record.status === "draft" || (includeConfirmed && record.status === "confirmed"))) {
        record.status = "superseded";
      }
    }
  }
  async saveLearningSignal(signal: LearningSignal, state: CanonicalKnowledgeState) {
    this.signals.set(signal.id, structuredClone(signal));
    this.knowledgeStates.set(`${state.ownerId}/${state.nodeId}`, structuredClone(state));
  }
  async listLearningSignals(ownerId: string, curriculumId?: string) {
    return Array.from(this.signals.values())
      .filter((item) => item.ownerId === ownerId && (!curriculumId || item.curriculumId === curriculumId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((item) => structuredClone(item));
  }
  async listKnowledgeStates(ownerId: string) {
    return Array.from(this.knowledgeStates.values()).filter((item) => item.ownerId === ownerId).map((item) => structuredClone(item));
  }
  async findCachedAnalysis(kind: string, inputHash: string, model: string) {
    return Array.from(this.runs.values()).find((run) =>
      run.kind === kind && run.inputHash === inputHash && run.model === model && run.status === "success",
    ) ?? null;
  }
  async getAnalysisUsageSince(ownerId: string, since: string) {
    const runs = Array.from(this.runs.values()).filter((run) => run.ownerId === ownerId && run.createdAt >= since && !run.cacheHit);
    return {
      calls: runs.length,
      tokens: runs.reduce((total, run) => total + run.promptTokens + run.completionTokens, 0),
    };
  }
  async saveAnalysisRun(run: AnalysisRunRecord) { this.runs.set(run.id, { ...run }); }
  async listAnalysisRuns(filter: AnalysisRunFilter = {}) {
    return Array.from(this.runs.values())
      .filter((run) => !filter.requestId || run.requestId === filter.requestId)
      .filter((run) => !filter.ownerId || run.ownerId === filter.ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (b.attempt ?? 0) - (a.attempt ?? 0))
      .slice(0, filter.limit ?? 100)
      .map((run) => structuredClone(run));
  }
  async linkAnalysisRuns(workflowRunId: string, decisionId: string) {
    for (const [id, run] of this.runs) {
      if (run.workflowRunId === workflowRunId) this.runs.set(id, { ...run, decisionId });
    }
  }
  async saveContentSource(source: ContentSource) { this.contentSources.set(source.id, structuredClone(source)); }
  async getContentSource(id: string, ownerId: string) {
    const source = this.contentSources.get(id);
    return source?.ownerId === ownerId ? structuredClone(source) : null;
  }
  async listContentSources(ownerId: string) {
    return Array.from(this.contentSources.values()).filter((source) => source.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((source) => structuredClone(source));
  }
  async saveContentAnalysis(analysis: ContentAnalysis) { this.contentAnalyses.set(analysis.id, structuredClone(analysis)); }
  async getLatestContentAnalysis(sourceId: string) {
    const analysis = Array.from(this.contentAnalyses.values()).filter((item) => item.sourceId === sourceId)
      .sort((a, b) => b.version - a.version)[0];
    return analysis ? structuredClone(analysis) : null;
  }
  async confirmContentFragments(sourceId: string, ownerId: string, fragmentIds: string[], decision: "confirmed" | "rejected") {
    const source = await this.getContentSource(sourceId, ownerId);
    const analysis = await this.getLatestContentAnalysis(sourceId);
    if (!source || !analysis) throw new Error("来源分析不存在");
    const selected = new Set(fragmentIds);
    const next = { ...analysis, fragments: analysis.fragments.map((fragment) => selected.has(fragment.id) ? { ...fragment, status: decision } : fragment) };
    await this.saveContentAnalysis(next);
    await this.saveContentSource({ ...source, status: next.fragments.some((fragment) => fragment.status === "confirmed") ? "confirmed" : decision === "rejected" ? "rejected" : source.status, updatedAt: new Date().toISOString() });
    return structuredClone(next);
  }
  async saveWorkflowRun(run: WorkflowRunRecord) { this.workflowRuns.set(run.id, structuredClone(run)); }
  async getWorkflowRunByAggregate(ownerId: string, aggregateId: string) {
    return structuredClone(Array.from(this.workflowRuns.values()).find((run) =>
      run.ownerId === ownerId && run.aggregateId === aggregateId,
    ) ?? null);
  }
  async getWorkflowRun(id: string, ownerId: string) {
    const run = this.workflowRuns.get(id);
    return run?.ownerId === ownerId ? structuredClone(run) : null;
  }
  async saveDecision(decision: DecisionRecord, event?: DecisionEvent) {
    this.decisions.set(decision.id, structuredClone(decision));
    if (event) this.decisionEvents.set(event.id, structuredClone(event));
  }
  async getDecision(id: string, ownerId: string) {
    const decision = this.decisions.get(id);
    return decision?.ownerId === ownerId ? structuredClone(decision) : null;
  }
  async listDecisions(ownerId: string, statuses?: DecisionStatus[]) {
    return Array.from(this.decisions.values())
      .filter((item) => item.ownerId === ownerId && (!statuses || statuses.includes(item.status)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((item) => structuredClone(item));
  }
  async listDecisionEvents(decisionId: string) {
    return Array.from(this.decisionEvents.values())
      .filter((item) => item.decisionId === decisionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((item) => structuredClone(item));
  }
  async resetOwnerState(ownerId: string) {
    for (const [id, record] of this.curricula) if (record.ownerId === ownerId) this.curricula.delete(id);
    for (const [id, record] of this.workflowRuns) if (record.ownerId === ownerId) this.workflowRuns.delete(id);
    const decisionIds = new Set(Array.from(this.decisions.values()).filter((item) => item.ownerId === ownerId).map((item) => item.id));
    for (const id of decisionIds) this.decisions.delete(id);
    for (const [id, event] of this.decisionEvents) if (decisionIds.has(event.decisionId)) this.decisionEvents.delete(id);
    for (const [id, signal] of this.signals) if (signal.ownerId === ownerId) this.signals.delete(id);
    for (const key of this.knowledgeStates.keys()) if (key.startsWith(`${ownerId}:`)) this.knowledgeStates.delete(key);
    const sourceIds = new Set(Array.from(this.contentSources.values()).filter((source) => source.ownerId === ownerId).map((source) => source.id));
    for (const id of sourceIds) this.contentSources.delete(id);
    for (const [id, analysis] of this.contentAnalyses) if (sourceIds.has(analysis.sourceId)) this.contentAnalyses.delete(id);
  }
}

// D1 类型声明不在当前依赖中；边界由接口和结构化解析保证。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function zodStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("课程标签数据无效");
  }
  return value;
}

function parseRecord(row: Record<string, unknown>): CurriculumRecord {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    status: curriculumRecordStatusSchema.parse(row.status),
    activationStatus: (row.activation_status ?? "inactive") as CurriculumRecord["activationStatus"],
    activationError: String(row.activation_error ?? ""),
    parentCurriculumId: row.parent_curriculum_id ? String(row.parent_curriculum_id) : null,
    graphVersionId: String(row.graph_version_id ?? ""),
    revision: Number(row.revision ?? 1),
    intake: learningIntakeSchema.parse(JSON.parse(String(row.intake_json))),
    assembly: curriculumAssemblySchema.parse(JSON.parse(String(row.assembly_json))),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function parseCandidate(row: Record<string, unknown>): CourseCandidateRecord {
  return {
    id: String(row.id), ownerId: String(row.owner_id), title: String(row.title),
    sourceUrl: String(row.source_url), outline: JSON.parse(String(row.outline_json)),
    analysisJson: String(row.analysis_json), candidateJson: String(row.candidate_json ?? "{}"),
    evalJson: String(row.eval_json ?? "{}"), impactJson: String(row.impact_json ?? "{}"),
    workflowRunId: row.workflow_run_id ? String(row.workflow_run_id) : null,
    status: row.status as CourseCandidateRecord["status"],
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function parseContentSource(row: Record<string, unknown>): ContentSource {
  return {
    id: String(row.id), ownerId: row.owner_id ? String(row.owner_id) : null, type: row.source_type as ContentSource["type"],
    title: String(row.title), canonicalUrl: row.canonical_url ? String(row.canonical_url) : null,
    rawContent: row.raw_content ? String(row.raw_content) : null, status: row.status as ContentSource["status"],
    sourceTrust: row.source_trust as ContentSource["sourceTrust"], createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function parseContentAnalysis(row: Record<string, unknown>): ContentAnalysis {
  return JSON.parse(String(row.analysis_json)) as ContentAnalysis;
}

function parseDecision(row: Record<string, unknown>): DecisionRecord {
  return decisionRecordSchema.parse({
    id: row.id, ownerId: row.owner_id ?? null, decisionType: row.decision_type,
    aggregateType: row.aggregate_type, aggregateId: row.aggregate_id,
    workflowRunId: row.workflow_run_id ?? null, riskLevel: row.risk_level, status: row.status,
    inputHash: row.input_hash, proposal: JSON.parse(String(row.proposal_json)),
    rationale: JSON.parse(String(row.rationale_json)), citations: JSON.parse(String(row.citations_json)),
    confidence: Number(row.confidence) / 1000, evalReport: JSON.parse(String(row.eval_json)),
    modelRoute: JSON.parse(String(row.model_route_json)), createdAt: row.created_at,
    updatedAt: row.updated_at, appliedAt: row.applied_at ?? null,
  });
}

export class D1CourseIntelligenceRepository implements CourseIntelligenceRepository {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async seedPublishedBaseline(): Promise<void> {
    const releaseId = "course-catalog-baseline@2026-08-30.v1";
    const seeded = await this.db.prepare("SELECT id FROM learning_ci_catalog_releases WHERE id=? LIMIT 1").bind(releaseId).first();
    if (seeded) return;
    for (const item of trustedSources) {
      await this.db.prepare(`INSERT INTO learning_ci_sources
        (id,title,url,source_class,purposes_json,provider,status,notes) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title,url=excluded.url,source_class=excluded.source_class,
          purposes_json=excluded.purposes_json,provider=excluded.provider,status=excluded.status,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP`)
        .bind(item.id, item.title, item.url, item.sourceClass, JSON.stringify(item.purposes), item.provider, item.status, item.notes)
        .run();
      await this.db.prepare(`INSERT OR IGNORE INTO learning_ci_source_snapshots
        (id,source_id,content_hash,retrieved_at,content_json,status) VALUES (?,?,?,?,?,?)`)
        .bind(`snapshot.${item.id}.2026-08-30`, item.id, `baseline:${item.id}:2026-08-30`, "2026-08-30", JSON.stringify({ title: item.title, url: item.url }), "published")
        .run();
    }

    await this.db.prepare(`INSERT OR IGNORE INTO learning_ci_graph_versions
      (id,version,title,status,graph_json,published_at) VALUES (?,?,?,?,?,?)`)
      .bind(publishedDomainGraph.id, publishedDomainGraph.version, publishedDomainGraph.title, publishedDomainGraph.status, JSON.stringify(publishedDomainGraph), publishedDomainGraph.publishedAt ?? null)
      .run();

    const mappings = baselineMappingsFor();
    for (const item of baselineCourses) {
      const versionId = `${item.genome.id}@${item.genome.version}`;
      await this.db.prepare(`INSERT INTO learning_ci_courses
        (id,provider,title,url,tags_json,published_version_id) VALUES (?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,title=excluded.title,url=excluded.url,
          tags_json=excluded.tags_json,published_version_id=excluded.published_version_id,updated_at=CURRENT_TIMESTAMP`)
        .bind(item.genome.id, item.genome.provider, item.genome.title, item.genome.url, JSON.stringify(item.tags), versionId)
        .run();
      await this.db.prepare(`INSERT OR IGNORE INTO learning_ci_course_versions
        (id,course_id,version,status,genome_json) VALUES (?,?,?,?,?)`)
        .bind(versionId, item.genome.id, item.genome.version, "published", JSON.stringify(item.genome))
        .run();
      for (const unit of item.genome.units) {
        await this.db.prepare(`INSERT OR IGNORE INTO learning_ci_course_units
          (id,course_version_id,unit_key,title,sequence,estimated_minutes,unit_json) VALUES (?,?,?,?,?,?,?)`)
          .bind(`${versionId}:${unit.id}`, versionId, unit.id, unit.title, unit.order, unit.estimatedMinutes ?? null, JSON.stringify(unit))
          .run();
      }
      for (const mapping of mappings.filter((candidate) => candidate.courseId === item.genome.id)) {
        await this.db.prepare(`INSERT OR IGNORE INTO learning_ci_unit_node_mappings
          (id,course_version_id,unit_key,node_id,depth,relation,confidence,mapping_json) VALUES (?,?,?,?,?,?,?,?)`)
          .bind(`${versionId}:${mapping.unitId}:${mapping.nodeId}`, versionId, mapping.unitId, mapping.nodeId, mapping.depth, mapping.relation, Math.round(mapping.confidence * 1000), JSON.stringify(mapping))
          .run();
      }
    }
    await this.db.prepare("INSERT OR IGNORE INTO learning_ci_catalog_releases (id) VALUES (?)").bind(releaseId).run();
  }

  async listSources(): Promise<TrustedSource[]> {
    const rows = await this.db.prepare(`SELECT id,title,url,source_class,purposes_json,provider,status,notes
      FROM learning_ci_sources WHERE status='published' ORDER BY provider,title`).all();
    return (rows.results as Array<Record<string, unknown>>).map((row) => trustedSourceSchema.parse({
      id: row.id,
      title: row.title,
      url: row.url,
      sourceClass: row.source_class,
      purposes: JSON.parse(String(row.purposes_json)),
      provider: row.provider,
      status: row.status,
      notes: row.notes,
    }));
  }

  async listSourcesDue(limit: number, now: string): Promise<TrustedSource[]> {
    const rows = await this.db.prepare(`SELECT id,title,url,source_class,purposes_json,provider,status,notes
      FROM learning_ci_sources WHERE status='published' AND (next_check_at IS NULL OR next_check_at<=?)
      ORDER BY COALESCE(last_checked_at,'') ASC LIMIT ?`).bind(now, limit).all();
    return (rows.results as Array<Record<string, unknown>>).map((row) => trustedSourceSchema.parse({
      id: row.id, title: row.title, url: row.url, sourceClass: row.source_class,
      purposes: JSON.parse(String(row.purposes_json)), provider: row.provider,
      status: row.status, notes: row.notes,
    }));
  }

  async markSourceCheckFailed(sourceId: string, error: string, checkedAt: string): Promise<void> {
    const nextCheck = new Date(new Date(checkedAt).getTime() + 86400000).toISOString();
    await this.db.prepare(`UPDATE learning_ci_sources SET last_checked_at=?,next_check_at=?,last_check_error=?,updated_at=? WHERE id=?`)
      .bind(checkedAt, nextCheck, error.slice(0, 1200), checkedAt, sourceId).run();
  }

  async saveSourceUpdateCandidate(snapshot: SourceSnapshotCandidate): Promise<SourceUpdateJobRecord> {
    const previous = await this.db.prepare(`SELECT id,content_hash FROM learning_ci_source_snapshots
      WHERE source_id=? ORDER BY created_at DESC LIMIT 1`).bind(snapshot.sourceId).first();
    const unchanged = previous && String(previous.content_hash) === snapshot.contentHash;
    const job: SourceUpdateJobRecord = {
      id: `source-job.${crypto.randomUUID()}`,
      sourceId: snapshot.sourceId,
      status: unchanged ? "unchanged" : "candidate",
      previousSnapshotId: previous ? String(previous.id) : null,
      candidateSnapshotId: unchanged ? null : snapshot.id,
      impactJson: JSON.stringify({ changed: !unchanged, requiresReview: !unchanged }),
      error: "",
      createdAt: snapshot.retrievedAt,
      updatedAt: snapshot.retrievedAt,
    };
    const statements = [];
    if (!unchanged) {
      statements.push(this.db.prepare(`INSERT OR IGNORE INTO learning_ci_source_snapshots
        (id,source_id,content_hash,retrieved_at,content_json,status) VALUES (?,?,?,?,?,'candidate')`)
        .bind(snapshot.id, snapshot.sourceId, snapshot.contentHash, snapshot.retrievedAt, snapshot.contentJson));
    }
    statements.push(this.db.prepare(`INSERT INTO learning_ci_source_update_jobs
      (id,source_id,status,previous_snapshot_id,candidate_snapshot_id,impact_json,error,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(job.id, job.sourceId, job.status, job.previousSnapshotId, job.candidateSnapshotId,
        job.impactJson, job.error, job.createdAt, job.updatedAt));
    await this.db.batch(statements);
    const nextCheck = new Date(new Date(snapshot.retrievedAt).getTime() + 7 * 86400000).toISOString();
    await this.db.prepare(`UPDATE learning_ci_sources SET last_checked_at=?,next_check_at=?,last_check_error='',updated_at=? WHERE id=?`)
      .bind(snapshot.retrievedAt, nextCheck, snapshot.retrievedAt, snapshot.sourceId).run();
    return job;
  }

  async listCourses(): Promise<PublishedCourse[]> {
    const rows = await this.db.prepare(`SELECT c.id,c.tags_json,v.id AS version_id,v.genome_json
      FROM learning_ci_courses c JOIN learning_ci_course_versions v ON v.id=c.published_version_id
      WHERE v.status='published' ORDER BY c.id`).all();
    const mappingRows = await this.db.prepare(`SELECT course_version_id,mapping_json
      FROM learning_ci_unit_node_mappings ORDER BY course_version_id,unit_key,node_id`).all();
    const mappingsByVersion = new Map<string, PublishedCourse["mappings"]>();
    for (const row of mappingRows.results as Array<Record<string, unknown>>) {
      const versionId = String(row.course_version_id);
      const mappings = mappingsByVersion.get(versionId) ?? [];
      mappings.push(unitNodeMappingSchema.parse(JSON.parse(String(row.mapping_json))));
      mappingsByVersion.set(versionId, mappings);
    }
    return (rows.results as Array<Record<string, unknown>>).map((row) => ({
      genome: courseGenomeSchema.parse(JSON.parse(String(row.genome_json))),
      tags: zodStringArray(JSON.parse(String(row.tags_json))),
      mappings: mappingsByVersion.get(String(row.version_id)) ?? [],
    }));
  }

  async listAvailableCourses(ownerId: string): Promise<PublishedCourse[]> {
    const shared = await this.listCourses();
    const rows = await this.db.prepare(`SELECT candidate_json FROM learning_ci_course_candidates
      WHERE owner_id=? AND status='personal_ready' ORDER BY updated_at DESC`).bind(ownerId).all();
    const personal = (rows.results as Array<Record<string, unknown>>).flatMap((row) => {
      try { return [publishedCourseSchema.parse(JSON.parse(String(row.candidate_json)))]; }
      catch { return []; }
    });
    return [...shared, ...personal];
  }

  async getPublishedGraph(): Promise<DomainGraph> {
    const row = await this.db.prepare("SELECT graph_json FROM learning_ci_graph_versions WHERE status='published' ORDER BY created_at DESC LIMIT 1").first();
    if (!row) throw new Error("尚未发布领域图");
    return domainGraphSchema.parse(JSON.parse(String(row.graph_json)));
  }

  async getCurriculum(id: string, ownerId: string): Promise<CurriculumRecord | null> {
    const row = await this.db.prepare("SELECT * FROM learning_ci_curricula WHERE id=? AND owner_id=? LIMIT 1").bind(id, ownerId).first();
    return row ? parseRecord(row) : null;
  }

  async getLatestCurriculum(ownerId: string, status?: "confirmed"): Promise<CurriculumRecord | null> {
    const row = await this.db.prepare("SELECT * FROM learning_ci_curricula WHERE owner_id=? AND status!='superseded' AND (? IS NULL OR status=?) ORDER BY updated_at DESC LIMIT 1").bind(ownerId, status ?? null, status ?? null).first();
    return row ? parseRecord(row) : null;
  }

  async listCurriculaUsingCourse(courseId: string): Promise<CurriculumRecord[]> {
    const rows = await this.db.prepare(`SELECT * FROM learning_ci_curricula
      WHERE status='confirmed' AND assembly_json LIKE ? ORDER BY updated_at DESC`)
      .bind(`%\"courseId\":\"${courseId.replace(/["%_]/g, "")}\"%`).all();
    return (rows.results as Array<Record<string, unknown>>).map(parseRecord);
  }

  async saveCurriculum(record: CurriculumRecord): Promise<void> {
    await this.db.prepare(`INSERT INTO learning_ci_curricula
      (id,owner_id,status,activation_status,activation_error,parent_curriculum_id,graph_version_id,revision,intake_json,assembly_json,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status,activation_status=excluded.activation_status,
        activation_error=excluded.activation_error,parent_curriculum_id=excluded.parent_curriculum_id,
        graph_version_id=excluded.graph_version_id,revision=excluded.revision,intake_json=excluded.intake_json,
        assembly_json=excluded.assembly_json,updated_at=excluded.updated_at`)
      .bind(record.id, record.ownerId, record.status, record.activationStatus, record.activationError,
        record.parentCurriculumId ?? null, record.graphVersionId ?? "", record.revision ?? 1,
        JSON.stringify(record.intake), JSON.stringify(record.assembly), record.createdAt, record.updatedAt)
      .run();
  }

  async saveCourseCandidate(candidate: CourseCandidateRecord): Promise<void> {
    await this.db.prepare(`INSERT INTO learning_ci_course_candidates
      (id,owner_id,title,source_url,outline_json,analysis_json,candidate_json,eval_json,impact_json,workflow_run_id,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,source_url=excluded.source_url,
        outline_json=excluded.outline_json,analysis_json=excluded.analysis_json,candidate_json=excluded.candidate_json,
        eval_json=excluded.eval_json,impact_json=excluded.impact_json,workflow_run_id=excluded.workflow_run_id,
        status=excluded.status,updated_at=excluded.updated_at`)
      .bind(candidate.id, candidate.ownerId, candidate.title, candidate.sourceUrl, JSON.stringify(candidate.outline),
        candidate.analysisJson, candidate.candidateJson ?? "{}", candidate.evalJson ?? "{}", candidate.impactJson ?? "{}",
        candidate.workflowRunId ?? null, candidate.status, candidate.createdAt, candidate.updatedAt)
      .run();
  }

  async getCourseCandidate(id: string): Promise<CourseCandidateRecord | null> {
    const row = await this.db.prepare("SELECT * FROM learning_ci_course_candidates WHERE id=? LIMIT 1").bind(id).first();
    return row ? parseCandidate(row) : null;
  }

  async listCourseCandidates(status?: CourseCandidateRecord["status"]): Promise<CourseCandidateRecord[]> {
    const where = status ? "WHERE status=?" : "";
    const statement = this.db.prepare(`SELECT * FROM learning_ci_course_candidates ${where} ORDER BY updated_at DESC`);
    const rows = status ? await statement.bind(status).all() : await statement.all();
    return (rows.results as Array<Record<string, unknown>>).map(parseCandidate);
  }

  async reviewCourseCandidate(candidateId: string, review: CandidateReviewRecord): Promise<void> {
    const status = review.decision === "validated" ? "validated" : "rejected";
    await this.db.batch([
      this.db.prepare("UPDATE learning_ci_course_candidates SET status=?,updated_at=? WHERE id=? AND status IN ('candidate','validated')")
        .bind(status, review.createdAt, candidateId),
      this.db.prepare(`INSERT INTO learning_ci_candidate_reviews
        (id,candidate_id,reviewer_owner_id,decision,reason,review_json,created_at) VALUES (?,?,?,?,?,?,?)`)
        .bind(review.id, review.candidateId, review.reviewerOwnerId, review.decision, review.reason, review.reviewJson, review.createdAt),
    ]);
  }

  async publishCourseCandidate(candidateId: string, course: PublishedCourse, review?: CandidateReviewRecord): Promise<void> {
    const candidate = await this.getCourseCandidate(candidateId);
    if (!candidate || !["candidate", "validated"].includes(candidate.status)) throw new Error("课程候选不存在或不可发布");
    const versionId = `${course.genome.id}@${course.genome.version}`;
    const statements = [
      this.db.prepare(`INSERT INTO learning_ci_courses
        (id,provider,title,url,tags_json,published_version_id) VALUES (?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,title=excluded.title,url=excluded.url,
          tags_json=excluded.tags_json,published_version_id=excluded.published_version_id,updated_at=CURRENT_TIMESTAMP`)
        .bind(course.genome.id, course.genome.provider, course.genome.title, course.genome.url, JSON.stringify(course.tags), versionId),
      this.db.prepare(`INSERT INTO learning_ci_course_versions
        (id,course_id,version,status,genome_json) VALUES (?,?,?,?,?)`)
        .bind(versionId, course.genome.id, course.genome.version, "published", JSON.stringify(course.genome)),
      ...course.genome.units.map((unit) => this.db.prepare(`INSERT INTO learning_ci_course_units
        (id,course_version_id,unit_key,title,sequence,estimated_minutes,unit_json) VALUES (?,?,?,?,?,?,?)`)
        .bind(`${versionId}:${unit.id}`, versionId, unit.id, unit.title, unit.order, unit.estimatedMinutes ?? null, JSON.stringify(unit))),
      ...course.mappings.map((mapping) => this.db.prepare(`INSERT INTO learning_ci_unit_node_mappings
        (id,course_version_id,unit_key,node_id,depth,relation,confidence,mapping_json) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(`${versionId}:${mapping.unitId}:${mapping.nodeId}`, versionId, mapping.unitId, mapping.nodeId, mapping.depth, mapping.relation, Math.round(mapping.confidence * 1000), JSON.stringify(mapping))),
      this.db.prepare("UPDATE learning_ci_course_candidates SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('candidate','validated')").bind(candidateId),
      ...(review ? [this.db.prepare(`INSERT INTO learning_ci_candidate_reviews
        (id,candidate_id,reviewer_owner_id,decision,reason,review_json,created_at) VALUES (?,?,?,?,?,?,?)`)
        .bind(review.id, review.candidateId, review.reviewerOwnerId, review.decision,
          review.reason, review.reviewJson, review.createdAt)] : []),
    ];
    await this.db.batch(statements);
  }

  async supersedeCurricula(ownerId: string, exceptId: string, includeConfirmed = false): Promise<void> {
    const statuses = includeConfirmed ? "('draft','confirmed')" : "('draft')";
    await this.db.prepare(`UPDATE learning_ci_curricula SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE owner_id=? AND id!=? AND status IN ${statuses}`)
      .bind(ownerId, exceptId).run();
  }

  async saveLearningSignal(signal: LearningSignal, state: CanonicalKnowledgeState): Promise<void> {
    await this.db.batch([
      this.db.prepare(`INSERT INTO learning_ci_learning_signals
        (id,owner_id,activity_id,curriculum_id,canonical_node_id,signal_type,value_json,note,question_id,context_json,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(signal.id, signal.ownerId, signal.activityId, signal.curriculumId, signal.canonicalNodeId,
          signal.type, JSON.stringify(signal.value), signal.note, signal.questionId ?? null,
          JSON.stringify(signal.context ?? {}), signal.createdAt),
      this.db.prepare(`INSERT INTO learning_ci_knowledge_states
        (owner_id,node_id,status,confidence,latest_signal_id,updated_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(owner_id,node_id) DO UPDATE SET status=excluded.status,confidence=excluded.confidence,
          latest_signal_id=excluded.latest_signal_id,updated_at=excluded.updated_at`)
        .bind(state.ownerId, state.nodeId, state.status, state.confidence, state.latestSignalId, state.updatedAt),
    ]);
  }

  async listLearningSignals(ownerId: string, curriculumId?: string): Promise<LearningSignal[]> {
    const where = curriculumId ? "owner_id=? AND curriculum_id=?" : "owner_id=?";
    const statement = this.db.prepare(`SELECT * FROM learning_ci_learning_signals WHERE ${where} ORDER BY created_at`);
    const rows = curriculumId ? await statement.bind(ownerId, curriculumId).all() : await statement.bind(ownerId).all();
    return (rows.results as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), ownerId: String(row.owner_id), activityId: String(row.activity_id),
      curriculumId: String(row.curriculum_id), canonicalNodeId: String(row.canonical_node_id),
      type: row.signal_type as LearningSignal["type"], value: JSON.parse(String(row.value_json)),
      note: String(row.note ?? ""), questionId: row.question_id ? String(row.question_id) : null,
      context: row.context_json ? JSON.parse(String(row.context_json)) as Record<string, unknown> : {},
      createdAt: String(row.created_at),
    }));
  }

  async listKnowledgeStates(ownerId: string): Promise<CanonicalKnowledgeState[]> {
    const rows = await this.db.prepare(`SELECT owner_id,node_id,status,confidence,latest_signal_id,updated_at
      FROM learning_ci_knowledge_states WHERE owner_id=? ORDER BY node_id`).bind(ownerId).all();
    return (rows.results as Array<Record<string, unknown>>).map((row) => ({
      ownerId: String(row.owner_id),
      nodeId: String(row.node_id),
      status: row.status as CanonicalKnowledgeState["status"],
      confidence: Number(row.confidence),
      latestSignalId: row.latest_signal_id ? String(row.latest_signal_id) : null,
      updatedAt: String(row.updated_at),
    }));
  }

  async findCachedAnalysis(kind: string, inputHash: string, model: string): Promise<AnalysisRunRecord | null> {
    const row = await this.db.prepare(`SELECT * FROM learning_ci_analysis_runs
      WHERE kind=? AND input_hash=? AND model=? AND status='success' ORDER BY created_at DESC LIMIT 1`)
      .bind(kind, inputHash, model).first();
    return row ? analysisRunFromRow(row as Record<string, unknown>) : null;
  }

  async getAnalysisUsageSince(ownerId: string, since: string): Promise<{ calls: number; tokens: number }> {
    const row = await this.db.prepare(`SELECT COUNT(*) AS calls,
      COALESCE(SUM(prompt_tokens + completion_tokens),0) AS tokens
      FROM learning_ci_analysis_runs WHERE owner_id=? AND created_at>=? AND cache_hit=0`)
      .bind(ownerId, since).first();
    return { calls: Number(row?.calls ?? 0), tokens: Number(row?.tokens ?? 0) };
  }

  async saveAnalysisRun(run: AnalysisRunRecord): Promise<void> {
    await this.db.prepare(`INSERT OR REPLACE INTO learning_ci_analysis_runs
      (id,owner_id,kind,input_hash,provider,model,status,output_json,error,prompt_tokens,completion_tokens,latency_ms,created_at,
       request_id,workflow_run_id,decision_id,slot,attempt,contract_version,failure_class,fallback_reason,cache_hit,eval_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(run.id, run.ownerId, run.kind, run.inputHash, run.provider, run.model, run.status, run.outputJson, run.error,
        run.promptTokens, run.completionTokens, run.latencyMs, run.createdAt, run.requestId ?? run.id,
        run.workflowRunId ?? null, run.decisionId ?? null, run.slot ?? "primary", run.attempt ?? 1,
        run.contractVersion ?? "legacy", run.failureClass ?? "", run.fallbackReason ?? "", Number(run.cacheHit ?? false), run.evalJson ?? "{}")
      .run();
  }

  async listAnalysisRuns(filter: AnalysisRunFilter = {}): Promise<AnalysisRunRecord[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (filter.requestId) { clauses.push("request_id=?"); values.push(filter.requestId); }
    if (filter.ownerId) { clauses.push("owner_id=?"); values.push(filter.ownerId); }
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 200);
    const rows = await this.db.prepare(`SELECT * FROM learning_ci_analysis_runs${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY created_at DESC, attempt DESC LIMIT ${limit}`).bind(...values).all();
    return (rows.results as Array<Record<string, unknown>>).map(analysisRunFromRow);
  }

  async linkAnalysisRuns(workflowRunId: string, decisionId: string): Promise<void> {
    await this.db.prepare(`UPDATE learning_ci_analysis_runs SET decision_id=? WHERE workflow_run_id=?`)
      .bind(decisionId, workflowRunId).run();
  }

  async saveContentSource(source: ContentSource): Promise<void> {
    await this.db.prepare(`INSERT INTO learning_content_sources
      (id,owner_id,source_type,title,canonical_url,raw_content,status,source_trust,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,canonical_url=excluded.canonical_url,
      raw_content=excluded.raw_content,status=excluded.status,source_trust=excluded.source_trust,updated_at=excluded.updated_at`)
      .bind(source.id, source.ownerId, source.type, source.title, source.canonicalUrl, source.rawContent, source.status, source.sourceTrust, source.createdAt, source.updatedAt).run();
  }

  async getContentSource(id: string, ownerId: string): Promise<ContentSource | null> {
    const row = await this.db.prepare("SELECT * FROM learning_content_sources WHERE id=? AND owner_id=? LIMIT 1").bind(id, ownerId).first();
    return row ? parseContentSource(row) : null;
  }

  async listContentSources(ownerId: string): Promise<ContentSource[]> {
    const rows = await this.db.prepare("SELECT * FROM learning_content_sources WHERE owner_id=? ORDER BY updated_at DESC").bind(ownerId).all();
    return (rows.results as Array<Record<string, unknown>>).map(parseContentSource);
  }

  async saveContentAnalysis(analysis: ContentAnalysis): Promise<void> {
    await this.db.prepare(`INSERT INTO learning_content_analysis_runs
      (id,source_id,version,mode,status,analysis_json,created_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status,analysis_json=excluded.analysis_json`)
      .bind(analysis.id, analysis.sourceId, analysis.version, analysis.mode, analysis.status, JSON.stringify(analysis), analysis.createdAt).run();
  }

  async getLatestContentAnalysis(sourceId: string): Promise<ContentAnalysis | null> {
    const row = await this.db.prepare("SELECT analysis_json FROM learning_content_analysis_runs WHERE source_id=? ORDER BY version DESC LIMIT 1").bind(sourceId).first();
    return row ? parseContentAnalysis(row) : null;
  }

  async confirmContentFragments(sourceId: string, ownerId: string, fragmentIds: string[], decision: "confirmed" | "rejected"): Promise<ContentAnalysis> {
    const source = await this.getContentSource(sourceId, ownerId);
    const analysis = await this.getLatestContentAnalysis(sourceId);
    if (!source || !analysis) throw new Error("来源分析不存在");
    const selected = new Set(fragmentIds);
    const next = { ...analysis, fragments: analysis.fragments.map((fragment) => selected.has(fragment.id) ? { ...fragment, status: decision } : fragment) };
    await this.saveContentAnalysis(next);
    await this.saveContentSource({ ...source, status: next.fragments.some((fragment) => fragment.status === "confirmed") ? "confirmed" : decision === "rejected" ? "rejected" : source.status, updatedAt: new Date().toISOString() });
    return next;
  }

  async saveWorkflowRun(run: WorkflowRunRecord): Promise<void> {
    await this.db.prepare(`INSERT INTO learning_workflow_runs
      (id,owner_id,workflow_id,aggregate_type,aggregate_id,status,current_step,last_error,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status,current_step=excluded.current_step,
        last_error=excluded.last_error,updated_at=excluded.updated_at`)
      .bind(run.id, run.ownerId, run.workflowId, run.aggregateType, run.aggregateId, run.status,
        run.currentStep, run.lastError, run.createdAt, run.updatedAt)
      .run();
  }

  async getWorkflowRunByAggregate(ownerId: string, aggregateId: string): Promise<WorkflowRunRecord | null> {
    const row = await this.db.prepare(`SELECT * FROM learning_workflow_runs
      WHERE owner_id=? AND aggregate_id=? ORDER BY updated_at DESC LIMIT 1`)
      .bind(ownerId, aggregateId).first();
    return row ? {
      id: String(row.id),
      ownerId: String(row.owner_id),
      workflowId: String(row.workflow_id),
      aggregateType: row.aggregate_type as WorkflowRunRecord["aggregateType"],
      aggregateId: String(row.aggregate_id),
      status: row.status as WorkflowRunRecord["status"],
      currentStep: String(row.current_step),
      lastError: String(row.last_error),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    } : null;
  }

  async getWorkflowRun(id: string, ownerId: string): Promise<WorkflowRunRecord | null> {
    const row = await this.db.prepare("SELECT * FROM learning_workflow_runs WHERE id=? AND owner_id=? LIMIT 1").bind(id, ownerId).first();
    return row ? {
      id: String(row.id), ownerId: String(row.owner_id), workflowId: String(row.workflow_id),
      aggregateType: row.aggregate_type as WorkflowRunRecord["aggregateType"], aggregateId: String(row.aggregate_id),
      status: row.status as WorkflowRunRecord["status"], currentStep: String(row.current_step),
      lastError: String(row.last_error), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    } : null;
  }

  async saveDecision(decision: DecisionRecord, event?: DecisionEvent): Promise<void> {
    const parsed = decisionRecordSchema.parse(decision);
    const statements = [this.db.prepare(`INSERT INTO learning_decisions
      (id,owner_id,decision_type,aggregate_type,aggregate_id,workflow_run_id,risk_level,status,input_hash,
       proposal_json,rationale_json,citations_json,confidence,eval_json,model_route_json,created_at,updated_at,applied_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET workflow_run_id=excluded.workflow_run_id,risk_level=excluded.risk_level,
       status=excluded.status,proposal_json=excluded.proposal_json,rationale_json=excluded.rationale_json,
       citations_json=excluded.citations_json,confidence=excluded.confidence,eval_json=excluded.eval_json,
       model_route_json=excluded.model_route_json,updated_at=excluded.updated_at,applied_at=excluded.applied_at`)
      .bind(parsed.id, parsed.ownerId, parsed.decisionType, parsed.aggregateType, parsed.aggregateId,
        parsed.workflowRunId, parsed.riskLevel, parsed.status, parsed.inputHash, JSON.stringify(parsed.proposal),
        JSON.stringify(parsed.rationale), JSON.stringify(parsed.citations), Math.round(parsed.confidence * 1000),
        JSON.stringify(parsed.evalReport), JSON.stringify(parsed.modelRoute), parsed.createdAt, parsed.updatedAt, parsed.appliedAt)];
    if (event) {
      const parsedEvent = decisionEventSchema.parse(event);
      statements.push(this.db.prepare(`INSERT INTO learning_decision_events
        (id,decision_id,from_status,to_status,actor_type,actor_owner_id,detail_json,created_at) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(parsedEvent.id, parsedEvent.decisionId, parsedEvent.fromStatus, parsedEvent.toStatus,
          parsedEvent.actorType, parsedEvent.actorOwnerId, JSON.stringify(parsedEvent.detail), parsedEvent.createdAt));
    }
    await this.db.batch(statements);
  }

  async getDecision(id: string, ownerId: string): Promise<DecisionRecord | null> {
    const row = await this.db.prepare("SELECT * FROM learning_decisions WHERE id=? AND owner_id=? LIMIT 1").bind(id, ownerId).first();
    return row ? parseDecision(row) : null;
  }

  async listDecisions(ownerId: string, statuses?: DecisionStatus[]): Promise<DecisionRecord[]> {
    const rows = await this.db.prepare("SELECT * FROM learning_decisions WHERE owner_id=? ORDER BY updated_at DESC").bind(ownerId).all();
    return (rows.results as Array<Record<string, unknown>>).map(parseDecision)
      .filter((item) => !statuses || statuses.includes(item.status));
  }

  async listDecisionEvents(decisionId: string): Promise<DecisionEvent[]> {
    const rows = await this.db.prepare("SELECT * FROM learning_decision_events WHERE decision_id=? ORDER BY created_at").bind(decisionId).all();
    return (rows.results as Array<Record<string, unknown>>).map((row) => decisionEventSchema.parse({
      id: row.id, decisionId: row.decision_id, fromStatus: row.from_status ?? null,
      toStatus: row.to_status, actorType: row.actor_type, actorOwnerId: row.actor_owner_id ?? null,
      detail: JSON.parse(String(row.detail_json)), createdAt: row.created_at,
    }));
  }

  async resetOwnerState(ownerId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare("DELETE FROM learning_decision_events WHERE decision_id IN (SELECT id FROM learning_decisions WHERE owner_id=?)").bind(ownerId),
      this.db.prepare("DELETE FROM learning_decisions WHERE owner_id=?").bind(ownerId),
      this.db.prepare("DELETE FROM learning_ci_learning_signals WHERE owner_id=?").bind(ownerId),
      this.db.prepare("DELETE FROM learning_ci_knowledge_states WHERE owner_id=?").bind(ownerId),
      this.db.prepare("DELETE FROM learning_workflow_runs WHERE owner_id=?").bind(ownerId),
      this.db.prepare("DELETE FROM learning_ci_curricula WHERE owner_id=?").bind(ownerId),
      this.db.prepare("DELETE FROM learning_content_analysis_runs WHERE source_id IN (SELECT id FROM learning_content_sources WHERE owner_id=?)").bind(ownerId),
      this.db.prepare("DELETE FROM learning_content_sources WHERE owner_id=?").bind(ownerId),
    ]);
  }
}

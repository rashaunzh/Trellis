import {
  curriculumAssemblySchema,
  curriculumRecordStatusSchema,
  courseGenomeSchema,
  domainGraphSchema,
  learningIntakeSchema,
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

export interface AnalysisRunRecord {
  id: string;
  ownerId: string | null;
  kind: string;
  inputHash: string;
  provider: string;
  model: string;
  status: "success" | "failed";
  outputJson: string;
  error: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  createdAt: string;
}

export interface WorkflowRunRecord {
  id: string;
  ownerId: string;
  workflowId: string;
  aggregateType: "curriculum";
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
  saveSourceUpdateCandidate(snapshot: SourceSnapshotCandidate): Promise<SourceUpdateJobRecord>;
  listCourses(): Promise<PublishedCourse[]>;
  getPublishedGraph(): Promise<DomainGraph>;
  getCurriculum(id: string, ownerId: string): Promise<CurriculumRecord | null>;
  getLatestCurriculum(ownerId: string): Promise<CurriculumRecord | null>;
  saveCurriculum(record: CurriculumRecord): Promise<void>;
  saveCourseCandidate(candidate: CourseCandidateRecord): Promise<void>;
  getCourseCandidate(id: string): Promise<CourseCandidateRecord | null>;
  listCourseCandidates(status?: CourseCandidateRecord["status"]): Promise<CourseCandidateRecord[]>;
  reviewCourseCandidate(candidateId: string, review: CandidateReviewRecord): Promise<void>;
  publishCourseCandidate(candidateId: string, course: PublishedCourse, review?: CandidateReviewRecord): Promise<void>;
  saveWorkflowRun(run: WorkflowRunRecord): Promise<void>;
  getWorkflowRunByAggregate(ownerId: string, aggregateId: string): Promise<WorkflowRunRecord | null>;
  supersedeCurricula(ownerId: string, exceptId: string, includeConfirmed?: boolean): Promise<void>;
  saveLearningSignal(signal: LearningSignal, state: CanonicalKnowledgeState): Promise<void>;
  listKnowledgeStates(ownerId: string): Promise<CanonicalKnowledgeState[]>;
  findCachedAnalysis(kind: string, inputHash: string, model: string): Promise<AnalysisRunRecord | null>;
  getAnalysisUsageSince(ownerId: string, since: string): Promise<{ calls: number; tokens: number }>;
  saveAnalysisRun(run: AnalysisRunRecord): Promise<void>;
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

  async seedPublishedBaseline() {}
  async listSources() { return structuredClone(trustedSources); }
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
  async getPublishedGraph() { return publishedDomainGraph; }
  async getCurriculum(id: string, ownerId: string) {
    const record = this.curricula.get(id);
    return record?.ownerId === ownerId ? structuredClone(record) : null;
  }
  async getLatestCurriculum(ownerId: string) {
    return Array.from(this.curricula.values())
      .filter((item) => item.ownerId === ownerId && item.status !== "superseded")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
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
  async listKnowledgeStates(ownerId: string) {
    return Array.from(this.knowledgeStates.values()).filter((item) => item.ownerId === ownerId).map((item) => structuredClone(item));
  }
  async findCachedAnalysis(kind: string, inputHash: string, model: string) {
    return Array.from(this.runs.values()).find((run) =>
      run.kind === kind && run.inputHash === inputHash && run.model === model && run.status === "success",
    ) ?? null;
  }
  async getAnalysisUsageSince(ownerId: string, since: string) {
    const runs = Array.from(this.runs.values()).filter((run) => run.ownerId === ownerId && run.createdAt >= since);
    return {
      calls: runs.length,
      tokens: runs.reduce((total, run) => total + run.promptTokens + run.completionTokens, 0),
    };
  }
  async saveAnalysisRun(run: AnalysisRunRecord) { this.runs.set(run.id, { ...run }); }
  async saveWorkflowRun(run: WorkflowRunRecord) { this.workflowRuns.set(run.id, structuredClone(run)); }
  async getWorkflowRunByAggregate(ownerId: string, aggregateId: string) {
    return structuredClone(Array.from(this.workflowRuns.values()).find((run) =>
      run.ownerId === ownerId && run.aggregateId === aggregateId,
    ) ?? null);
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
    intake: learningIntakeSchema.parse(JSON.parse(String(row.intake_json))),
    assembly: curriculumAssemblySchema.parse(JSON.parse(String(row.assembly_json))),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
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

  async getPublishedGraph(): Promise<DomainGraph> {
    const row = await this.db.prepare("SELECT graph_json FROM learning_ci_graph_versions WHERE status='published' ORDER BY created_at DESC LIMIT 1").first();
    if (!row) throw new Error("尚未发布领域图");
    return domainGraphSchema.parse(JSON.parse(String(row.graph_json)));
  }

  async getCurriculum(id: string, ownerId: string): Promise<CurriculumRecord | null> {
    const row = await this.db.prepare("SELECT * FROM learning_ci_curricula WHERE id=? AND owner_id=? LIMIT 1").bind(id, ownerId).first();
    return row ? parseRecord(row) : null;
  }

  async getLatestCurriculum(ownerId: string): Promise<CurriculumRecord | null> {
    const row = await this.db.prepare("SELECT * FROM learning_ci_curricula WHERE owner_id=? AND status!='superseded' ORDER BY updated_at DESC LIMIT 1").bind(ownerId).first();
    return row ? parseRecord(row) : null;
  }

  async saveCurriculum(record: CurriculumRecord): Promise<void> {
    await this.db.prepare(`INSERT INTO learning_ci_curricula
      (id,owner_id,status,activation_status,activation_error,intake_json,assembly_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status,activation_status=excluded.activation_status,
        activation_error=excluded.activation_error,intake_json=excluded.intake_json,assembly_json=excluded.assembly_json,updated_at=excluded.updated_at`)
      .bind(record.id, record.ownerId, record.status, record.activationStatus, record.activationError, JSON.stringify(record.intake), JSON.stringify(record.assembly), record.createdAt, record.updatedAt)
      .run();
  }

  async saveCourseCandidate(candidate: CourseCandidateRecord): Promise<void> {
    await this.db.prepare(`INSERT INTO learning_ci_course_candidates
      (id,owner_id,title,source_url,outline_json,analysis_json,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,source_url=excluded.source_url,
        outline_json=excluded.outline_json,analysis_json=excluded.analysis_json,status=excluded.status,updated_at=excluded.updated_at`)
      .bind(candidate.id, candidate.ownerId, candidate.title, candidate.sourceUrl, JSON.stringify(candidate.outline), candidate.analysisJson, candidate.status, candidate.createdAt, candidate.updatedAt)
      .run();
  }

  async getCourseCandidate(id: string): Promise<CourseCandidateRecord | null> {
    const row = await this.db.prepare("SELECT * FROM learning_ci_course_candidates WHERE id=? LIMIT 1").bind(id).first();
    return row ? {
      id: String(row.id),
      ownerId: String(row.owner_id),
      title: String(row.title),
      sourceUrl: String(row.source_url),
      outline: JSON.parse(String(row.outline_json)),
      analysisJson: String(row.analysis_json),
      status: row.status as CourseCandidateRecord["status"],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    } : null;
  }

  async listCourseCandidates(status?: CourseCandidateRecord["status"]): Promise<CourseCandidateRecord[]> {
    const where = status ? "WHERE status=?" : "";
    const statement = this.db.prepare(`SELECT * FROM learning_ci_course_candidates ${where} ORDER BY updated_at DESC`);
    const rows = status ? await statement.bind(status).all() : await statement.all();
    return (rows.results as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      ownerId: String(row.owner_id),
      title: String(row.title),
      sourceUrl: String(row.source_url),
      outline: JSON.parse(String(row.outline_json)),
      analysisJson: String(row.analysis_json),
      status: row.status as CourseCandidateRecord["status"],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
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
        (id,owner_id,activity_id,curriculum_id,canonical_node_id,signal_type,value_json,note,created_at)
        VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(signal.id, signal.ownerId, signal.activityId, signal.curriculumId, signal.canonicalNodeId, signal.type, JSON.stringify(signal.value), signal.note, signal.createdAt),
      this.db.prepare(`INSERT INTO learning_ci_knowledge_states
        (owner_id,node_id,status,confidence,latest_signal_id,updated_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(owner_id,node_id) DO UPDATE SET status=excluded.status,confidence=excluded.confidence,
          latest_signal_id=excluded.latest_signal_id,updated_at=excluded.updated_at`)
        .bind(state.ownerId, state.nodeId, state.status, state.confidence, state.latestSignalId, state.updatedAt),
    ]);
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
    return row ? {
      id: String(row.id), ownerId: row.owner_id ? String(row.owner_id) : null, kind: String(row.kind), inputHash: String(row.input_hash),
      provider: String(row.provider), model: String(row.model), status: "success", outputJson: String(row.output_json), error: String(row.error),
      promptTokens: Number(row.prompt_tokens), completionTokens: Number(row.completion_tokens), latencyMs: Number(row.latency_ms), createdAt: String(row.created_at),
    } : null;
  }

  async getAnalysisUsageSince(ownerId: string, since: string): Promise<{ calls: number; tokens: number }> {
    const row = await this.db.prepare(`SELECT COUNT(*) AS calls,
      COALESCE(SUM(prompt_tokens + completion_tokens),0) AS tokens
      FROM learning_ci_analysis_runs WHERE owner_id=? AND created_at>=?`)
      .bind(ownerId, since).first();
    return { calls: Number(row?.calls ?? 0), tokens: Number(row?.tokens ?? 0) };
  }

  async saveAnalysisRun(run: AnalysisRunRecord): Promise<void> {
    await this.db.prepare(`INSERT OR REPLACE INTO learning_ci_analysis_runs
      (id,owner_id,kind,input_hash,provider,model,status,output_json,error,prompt_tokens,completion_tokens,latency_ms,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(run.id, run.ownerId, run.kind, run.inputHash, run.provider, run.model, run.status, run.outputJson, run.error, run.promptTokens, run.completionTokens, run.latencyMs, run.createdAt)
      .run();
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
      WHERE owner_id=? AND aggregate_type='curriculum' AND aggregate_id=? ORDER BY updated_at DESC LIMIT 1`)
      .bind(ownerId, aggregateId).first();
    return row ? {
      id: String(row.id),
      ownerId: String(row.owner_id),
      workflowId: String(row.workflow_id),
      aggregateType: "curriculum",
      aggregateId: String(row.aggregate_id),
      status: row.status as WorkflowRunRecord["status"],
      currentStep: String(row.current_step),
      lastError: String(row.last_error),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    } : null;
  }
}

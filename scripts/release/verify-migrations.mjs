import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync("drizzle/migration-manifest.json", "utf8"));
if (manifest.authority !== "ordered-reviewed-sql" || !Array.isArray(manifest.files)) {
  throw new Error("Invalid migration manifest");
}

const seen = new Set();
const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");

for (const [index, file] of manifest.files.entries()) {
  const prefix = String(index).padStart(4, "0");
  if (!file.startsWith(prefix) || seen.has(file)) throw new Error(`Migration order is invalid at ${file}`);
  seen.add(file);
  const sql = readFileSync(join("drizzle", file), "utf8");
  db.exec(sql);
  console.log(`PASS ${file}`);
}

const required = [
  "learning_ci_courses",
  "learning_ci_course_candidates",
  "learning_ci_knowledge_states",
  "learning_ci_learning_signals",
  "learning_content_seed_versions",
  "learning_ci_catalog_releases",
];
const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name));
for (const table of required) {
  if (!tables.has(table)) throw new Error(`Missing required table ${table}`);
}

const activityColumns = new Set(db.prepare("PRAGMA table_info(learning_activities)").all().map((row) => row.name));
for (const column of ["curriculum_id", "course_version_id", "course_id", "unit_key", "canonical_node_id"]) {
  if (!activityColumns.has(column)) throw new Error(`Missing learning_activities.${column}`);
}

db.close();
console.log(`PASS migration chain (${manifest.files.length} files)`);

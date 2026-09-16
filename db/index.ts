import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export async function getDb() {
  // Defer the Workers-only module until request time so the built worker can
  // still be inspected by Node during artifact validation.
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

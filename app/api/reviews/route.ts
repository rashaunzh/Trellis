import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { weeklyReviews } from "../../../db/schema";

export async function GET(request: Request) {
  try {
    const weekKey = new URL(request.url).searchParams.get("weekKey");
    if (!weekKey) return Response.json({ error:"周次不能为空" }, { status:400 });
    const db = await getDb();
    const [review] = await db.select().from(weeklyReviews).where(eq(weeklyReviews.weekKey,weekKey)).limit(1);
    return Response.json({ review:review ?? null });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "读取复盘失败" }, { status:500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      weekKey?:string; progress?:string; deviation?:string; feedback?:string; adjustments?:string;
    };
    if (!payload.weekKey) return Response.json({ error:"周次不能为空" }, { status:400 });
    const db = await getDb();
    const existing = await db.select().from(weeklyReviews).where(eq(weeklyReviews.weekKey,payload.weekKey)).limit(1);
    const values = {
      progress:payload.progress ?? "",
      deviation:payload.deviation ?? "",
      feedback:payload.feedback ?? "",
      adjustments:payload.adjustments ?? "",
      updatedAt:new Date().toISOString(),
    };
    const [review] = existing.length
      ? await db.update(weeklyReviews).set(values).where(eq(weeklyReviews.weekKey,payload.weekKey)).returning()
      : await db.insert(weeklyReviews).values({ id:crypto.randomUUID(), weekKey:payload.weekKey, ...values }).returning();
    return Response.json({ review });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "保存复盘失败" }, { status:500 });
  }
}

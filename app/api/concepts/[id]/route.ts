import { requireLegacyRuntime, jsonError } from "../../learning/_shared";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { records } from "../../../../db/schema";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    await requireLegacyRuntime(request);
    const {id} = await context.params;
    const payload = await request.json() as {familiar?:boolean};
    if (typeof payload.familiar !== "boolean") {
      return Response.json({error:"熟悉状态必须是布尔值"},{status:400});
    }
    const db = await getDb();
    const [row] = await db.update(records)
      .set({acceptance:payload.familiar ? "passed" : "unreviewed",updatedAt:new Date().toISOString()})
      .where(eq(records.id,id))
      .returning();
    return row
      ? Response.json({concept:{id:row.id,familiar:row.acceptance === "passed"}})
      : Response.json({error:"概念卡不存在"},{status:404});
  } catch (error) {
    return jsonError(error);
  }
}

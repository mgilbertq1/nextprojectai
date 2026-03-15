import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function logUsage(
  userId: string,
  endpoint: string,
  tokens: number
) {
  await db.execute(sql`
    insert into usage_logs (id, user_id, tokens, endpoint)
    values (${randomUUID()}, ${userId}, ${tokens}, ${endpoint})
  `);
}
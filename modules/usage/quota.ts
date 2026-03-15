import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

const DAILY_LIMIT = 50000;

export async function enforceDailyQuota(userId: string, role: string) {
  if (role === "admin") return;

  const todayUsage = await db.execute<{ total: number }>(sql`
    select coalesce(sum(tokens), 0)::int as total
    from usage_logs
    where user_id = ${userId}
      and created_at >= date_trunc('day', now())
  `);

  const used = todayUsage[0]?.total ?? 0;

  if (used >= DAILY_LIMIT) {
    throw new Error("Daily token limit exceeded");
  }
}

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}
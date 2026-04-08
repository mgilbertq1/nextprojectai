import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

async function getDailyLimit(): Promise<number> {
  const result = await db.execute<{ value: string }>(sql`
    select value from system_flags
    where key = 'daily_token_quota'
    limit 1
  `);
  return parseInt(result[0]?.value ?? "50000");
}

export async function enforceDailyQuota(userId: string, role: string) {
  if (role === "admin") return;

  const [limit, usageResult] = await Promise.all([
    getDailyLimit(),
    db.execute<{ total: number }>(sql`
      select coalesce(sum(tokens), 0)::int as total
      from usage_logs
      where user_id = ${userId}
        and created_at >= date_trunc('day', now())
    `),
  ]);

  const used = usageResult[0]?.total ?? 0;

  if (used >= limit) {
    throw new Error("Daily token limit exceeded");
  }
}

export async function getUserQuotaUsage(userId: string) {
  const [limitResult, usageResult] = await Promise.all([
    getDailyLimit(),
    db.execute<{ total: number }>(sql`
      select coalesce(sum(tokens), 0)::int as total
      from usage_logs
      where user_id = ${userId}
        and created_at >= date_trunc('day', now())
    `),
  ]);

  const limit = limitResult;
  const used = usageResult[0]?.total ?? 0;
  const remaining = Math.max(0, limit - used);
  const pct = Math.min(Math.round((used / limit) * 100), 100);

  return { used, limit, remaining, pct, reset_at: "midnight UTC" };
}

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}
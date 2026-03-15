import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export async function getMessageTrend(from: Date | null, to: Date | null) {
  return db.execute(sql`
    select date_trunc('day', created_at) as date,
           count(*)::int as value
    from chats
    ${from && to ? sql`where created_at between ${from} and ${to}` : sql``}
    group by date
    order by date asc
  `);
}

export async function getTokenTrend(from: Date | null, to: Date | null) {
  return db.execute(sql`
    select date_trunc('day', created_at) as date,
           coalesce(sum(tokens),0)::int as value
    from usage_logs
    ${from && to ? sql`where created_at between ${from} and ${to}` : sql``}
    group by date
    order by date asc
  `);
}
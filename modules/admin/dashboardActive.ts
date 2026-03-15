import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

function calculateGrowth(current: number, previous: number) {
  if (previous === 0) return 100;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function getInterval(range: string) {
  switch (range) {
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    case "24h":
    default:
      return "24 hours";
  }
}

export async function getActiveUsers(range: string = "24h") {

  const interval = getInterval(range);

  const [current] = await db.execute<{ count: number }>(sql`
    select count(distinct user_id)::int as count
    from chats
    where created_at >= now() - ${interval}
  `);

  const [previous] = await db.execute<{ count: number }>(sql`
    select count(distinct user_id)::int as count
    from chats
    where created_at >= now() - (${interval} * 2)
      and created_at < now() - ${interval}
  `);

  const growth_pct = calculateGrowth(
    current.count,
    previous.count
  );

  return {
    range,
    active_users: current.count,
    growth_pct
  };
}

import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

function calculateGrowth(current: number, previous: number) {
  if (previous === 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export async function getDashboardOverview() {

  const [totalUsers] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from users
    where deleted_at is null
  `);

  const [usersLastMonth] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from users
    where deleted_at is null
      and created_at < date_trunc('month', now())
  `);

  const users_growth_pct = calculateGrowth(
    totalUsers.count,
    usersLastMonth.count
  );

  const [newUsersThisMonth] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from users
    where deleted_at is null
      and created_at >= date_trunc('month', now())
  `);

  const [newUsersLastMonth] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from users
    where deleted_at is null
      and created_at >= date_trunc('month', now()) - interval '1 month'
      and created_at < date_trunc('month', now())
  `);

  const new_users_growth_pct = calculateGrowth(
    newUsersThisMonth.count,
    newUsersLastMonth.count
  );

  const [tokens] = await db.execute<{ total: number }>(sql`
    select coalesce(sum(tokens),0)::int as total
    from usage_logs
  `);

  const [tokensLastMonth] = await db.execute<{ total: number }>(sql`
    select coalesce(sum(tokens),0)::int as total
    from usage_logs
    where created_at < date_trunc('month', now())
  `);

  const tokens_growth_pct = calculateGrowth(
    tokens.total,
    tokensLastMonth.total
  );

  return {
    users_total: totalUsers.count,
    users_growth_pct,
    new_users_this_month: newUsersThisMonth.count,
    new_users_growth_pct,
    tokens_total: tokens.total,
    tokens_growth_pct,
  };
}
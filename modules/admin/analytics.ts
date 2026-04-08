import { db } from "@/db/drizzle";
import { sql } from "drizzle-orm";

// ================================
// EXISTING (keep as is)
// ================================

export async function getMessageTrend(from: Date, to: Date) {
  return db.execute(sql`
    select
      date_trunc('day', created_at)::date as date,
      count(*)::int as messages
    from chats
    where created_at between ${from} and ${to}
    group by 1
    order by 1 asc
  `);
}

export async function getTokenTrend(from: Date, to: Date) {
  return db.execute(sql`
    select
      date_trunc('day', created_at)::date as date,
      coalesce(sum(tokens), 0)::int as tokens
    from usage_logs
    where created_at between ${from} and ${to}
    group by 1
    order by 1 asc
  `);
}

// ================================
// ANALYTICS OVERVIEW (stat cards)
// ================================
export async function getAnalyticsOverview() {
  const [totalUsers] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from users
  where deleted_at is null
  `);

  const [bannedUsers] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from users where deleted_at is null and banned = true
  `);

  const [activeUsers] = await db.execute<{ count: number }>(sql`
    select count(distinct user_id)::int as count
    from chats
    where created_at >= now() - interval '24 hours'
  `);

  const [chatUsers] = await db.execute<{ count: number }>(sql`
    select count(distinct user_id)::int as count from chats
  `);

  const [totalUsersLastMonth] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from users
    where deleted_at is null
      and created_at < date_trunc('month', now())
  `);

  const [bannedLastMonth] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from users
    where deleted_at is null
      and banned = true
      and created_at < date_trunc('month', now())
  `);

  const [activeUsersLastMonth] = await db.execute<{ count: number }>(sql`
    select count(distinct user_id)::int as count
    from chats
    where created_at >= now() - interval '48 hours'
      and created_at < now() - interval '24 hours'
  `);

  const [chatUsersLastMonth] = await db.execute<{ count: number }>(sql`
    select count(distinct user_id)::int as count
    from chats
    where created_at < date_trunc('month', now())
  `);

  const calcGrowth = (curr: number, prev: number) =>
    prev === 0 ? 0 : Number((((curr - prev) / prev) * 100).toFixed(1));

  return {
    total_users: totalUsers.count,
    total_users_growth: calcGrowth(totalUsers.count, totalUsersLastMonth.count),
    active_users: activeUsers.count,
    active_users_growth: calcGrowth(
      activeUsers.count,
      activeUsersLastMonth.count,
    ),
    banned_users: bannedUsers.count,
    banned_users_growth: calcGrowth(bannedUsers.count, bannedLastMonth.count),
    chat_users: chatUsers.count,
    chat_users_growth: calcGrowth(chatUsers.count, chatUsersLastMonth.count),
  };
}

// ================================
// ENGAGEMENT TREND (line chart)
// ================================
export async function getEngagementTrend() {
  const raw = await db.execute<{ month: Date; active_users: number }>(sql`
    with months as (
      select generate_series(
        date_trunc('month', now()) - interval '6 months',
        date_trunc('month', now()),
        interval '1 month'
      ) as month
    )
    select
      m.month,
      coalesce(count(distinct c.user_id), 0)::int as active_users
    from months m
    left join chats c
      on date_trunc('month', c.created_at) = m.month
    group by m.month
    order by m.month asc
  `);

  return raw.map((row) => ({
    name: new Date(row.month).toLocaleString("default", { month: "short" }),
    value: row.active_users,
  }));
}

// ================================
// USER ANALYTICS TABLE
// ================================
export async function getAnalyticsUsers(
  page: number,
  limit: number,
  search: string,
  status: string,
) {
  const offset = (page - 1) * limit;

  const statusFilter =
    status === "Active"
      ? sql`and u.banned = false`
      : status === "Banned"
        ? sql`and u.banned = true`
        : sql``;

  const searchFilter = search
    ? sql`and (u.email ilike ${"%" + search + "%"} or u.name ilike ${"%" + search + "%"} or u.username ilike ${"%" + search + "%"})`
    : sql``;

  const rows = await db.execute(sql`
    select
      u.id,
      coalesce(u.name, u.username, u.email) as name,
      u.email,
      u.banned,
      count(c.id)::int as chats,
      coalesce(sum(ul.tokens), 0)::int as tokens
    from users u
    left join chats c on c.user_id = u.id
    left join usage_logs ul on ul.user_id = u.id
    where u.deleted_at is null
      ${statusFilter}
      ${searchFilter}
    group by u.id
    order by chats desc
    limit ${limit}
    offset ${offset}
  `);

  const [total] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from users u
    where u.deleted_at is null
      ${statusFilter}
      ${searchFilter}
  `);

  return {
    data: rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      chats: r.chats,
      tokens: r.tokens,
      status: r.banned ? "Banned" : "Active",
    })),
    total: total.count,
    page,
    limit,
  };
}

export async function getModelUsageStats() {
  const result = await db.execute<{ name: string; value: number }>(sql`
    select
      m.name,
      count(c.id)::int as value
    from chats c
    join ai_models m on m.id = c.ai_model_id
    where c.ai_model_id is not null
      and c.role = 'assistant'
    group by m.name
    order by value desc
  `);

  // db.execute kadang return { rows: [...] } bukan array langsung
  const rows = Array.isArray(result) ? result : ((result as any).rows ?? []);

  return rows.map((r: any) => ({
    name: r.name,
    value: Number(r.value),
  }));
}

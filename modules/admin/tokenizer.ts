import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

// ================================
// TOKENIZER OVERVIEW (stat cards)
// ================================
export async function getTokenizerOverview() {
  // Tokens today
  const [tokensToday] = await db.execute<{ total: number }>(sql`
    select coalesce(sum(tokens), 0)::int as total
    from usage_logs
    where created_at >= date_trunc('day', now())
  `);

  const [tokensYesterday] = await db.execute<{ total: number }>(sql`
    select coalesce(sum(tokens), 0)::int as total
    from usage_logs
    where created_at >= date_trunc('day', now()) - interval '1 day'
      and created_at < date_trunc('day', now())
  `);

  // Weekly stats
  const [weeklyStats] = await db.execute<{
    total_tokens: number;
    total_requests: number;
    total_cost: number;
  }>(sql`
    select
      coalesce(sum(tokens), 0)::int as total_tokens,
      count(*)::int as total_requests,
      -- estimate cost: $0.00001 per token (grok pricing placeholder)
      round((coalesce(sum(tokens), 0) * 0.00001)::numeric, 4)::float as total_cost
    from usage_logs
    where created_at >= now() - interval '7 days'
  `);

  const [weeklyStatsLastWeek] = await db.execute<{ total_requests: number }>(sql`
    select count(*)::int as total_requests
    from usage_logs
    where created_at >= now() - interval '14 days'
      and created_at < now() - interval '7 days'
  `);

  const calcGrowth = (curr: number, prev: number) =>
    prev === 0 ? 0 : Number((((curr - prev) / prev) * 100).toFixed(1));

  const avgTokensPerRequest = weeklyStats.total_requests > 0
    ? Math.round(weeklyStats.total_tokens / weeklyStats.total_requests)
    : 0;

  return {
    tokens_today: tokensToday.total,
    tokens_yesterday: tokensYesterday.total,
    tokens_today_growth: calcGrowth(tokensToday.total, tokensYesterday.total),
    weekly_tokens: weeklyStats.total_tokens,
    weekly_requests: weeklyStats.total_requests,
    weekly_cost: weeklyStats.total_cost,
    weekly_requests_growth: calcGrowth(
      weeklyStats.total_requests,
      weeklyStatsLastWeek.total_requests
    ),
    avg_tokens_per_request: avgTokensPerRequest,
  };
}

// ================================
// TOKEN USAGE HISTORY (last 7 days)
// ================================
export async function getTokenUsageHistory() {
  const rows = await db.execute<{
    date: string;
    tokens: number;
    requests: number;
    cost: number;
  }>(sql`
    with days as (
      select generate_series(
        date_trunc('day', now()) - interval '6 days',
        date_trunc('day', now()),
        interval '1 day'
      ) as day
    )
    select
      to_char(d.day, 'Mon DD') as date,
      coalesce(sum(ul.tokens), 0)::int as tokens,
      coalesce(count(ul.id), 0)::int as requests,
      round((coalesce(sum(ul.tokens), 0) * 0.00001)::numeric, 4)::float as cost
    from days d
    left join usage_logs ul
      on date_trunc('day', ul.created_at) = d.day
    group by d.day
    order by d.day asc
  `);

  return rows;
}

// ================================
// RECENT TOKENIZATIONS (latest chats)
// ================================
export async function getRecentTokenizations(limit = 5) {
  const rows = await db.execute(sql`
    select distinct on (c.id)
      c.id,
      c.content,
      c.created_at,
      ul.tokens,
      ul.model
    from chats c
    left join usage_logs ul on ul.user_id = c.user_id
      and date_trunc('minute', ul.created_at) = date_trunc('minute', c.created_at)
    where c.role = 'user'
      and c.content is not null
    order by c.id, c.created_at desc
    limit ${limit}
  `);

  return rows.map((r: any) => ({
    id: r.id,
    text: r.content,
    tokens: r.tokens ?? 0,
    model: r.model ?? "Grok 4.1",
    created_at: r.created_at,
  }));
}
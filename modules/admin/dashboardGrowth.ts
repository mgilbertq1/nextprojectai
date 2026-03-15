import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export async function getUsersMonthlyGrowth() {
  const raw = await db.execute<{
    month: Date;
    users: number;
  }>(sql`
    with months as (
      select generate_series(
        date_trunc('month', now()) - interval '11 months',
        date_trunc('month', now()),
        interval '1 month'
      ) as month
    )
    select
      m.month,
      coalesce(count(u.id), 0)::int as users
    from months m
    left join users u
      on date_trunc('month', u.created_at) = m.month
    group by m.month
    order by m.month asc
  `);

  let cumulative = 0;
  let previous = 0;

  const result = raw.map((row) => {
    cumulative += Number(row.users);

    const growth_pct =
      previous === 0
        ? 0 // 👈 ubah dari 100 jadi 0 supaya tidak aneh
        : Number((((cumulative - previous) / previous) * 100).toFixed(2));

    previous = cumulative;

    const date = new Date(row.month);

    return {
      month: date.toISOString(),
      label: date.toLocaleString("default", { month: "short" }),
      users_total: cumulative,
      growth_pct,
    };
  });

  return result;
}

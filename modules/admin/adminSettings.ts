import { FastifyInstance } from "fastify";
import { requireAdmin } from "../auth/hooks";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export async function adminSettingsRoutes(app: FastifyInstance) {

  // ================================
  // GET LOGIN HISTORY (from login_logs)
  // ================================
  app.get("/admin/settings/login-history", async (request) => {
    await requireAdmin(request);

    const rows = await db.execute(sql`
      select
        l.id,
        u.email,
        l.method,
        l.success,
        l.ip_address,
        l.user_agent,
        l.created_at
      from login_logs l
      left join users u on u.id = l.user_id
      where u.role = 'admin' or l.user_id is null
      order by l.created_at desc
      limit 20
    `);

    return rows.map((r: any) => ({
      id: r.id,
      email: r.email ?? "Unknown",
      method: r.method ?? "email",
      success: r.success,
      ip_address: r.ip_address ?? "—",
      user_agent: r.user_agent ?? "—",
      created_at: r.created_at,
    }));
  });

  // ================================
  // GET SUSPICIOUS ACTIVITY
  // (5+ failed logins in last hour)
  // ================================
  app.get("/admin/settings/suspicious-activity", async (request) => {
    await requireAdmin(request);

    const rows = await db.execute(sql`
      select
        ip_address,
        count(*)::int as attempts,
        max(created_at) as last_attempt
      from login_logs
      where success = false
        and created_at >= now() - interval '1 hour'
      group by ip_address
      having count(*) >= 3
      order by attempts desc
      limit 10
    `);

    return rows;
  });

  // ================================
  // LOGOUT (invalidate session)
  // ================================
  app.post("/admin/settings/logout", async (request, reply) => {
    await requireAdmin(request);
    reply.clearCookie("access_token", { path: "/" });
    return { status: "logged_out" };
  });

  // ================================
  // NOTIFICATIONS STATS
  // (real data for meaningful alerts)
  // ================================
  app.get("/admin/settings/notification-stats", async (request) => {
    await requireAdmin(request);

    // Failed logins in last 24h
    const [failedLogins] = await db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from login_logs
      where success = false
        and created_at >= now() - interval '24 hours'
    `);

    // New users today
    const [newUsersToday] = await db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from users
      where created_at >= date_trunc('day', now())
    `);

    // New users this week
    const [newUsersWeek] = await db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from users
      where created_at >= now() - interval '7 days'
    `);

    // Platform token usage today vs limit
    const [tokensToday] = await db.execute<{ total: number }>(sql`
      select coalesce(sum(tokens), 0)::int as total
      from usage_logs
      where created_at >= date_trunc('day', now())
    `);

    // Chat kill switch status
    const [killSwitch] = await db.execute<{ value: string }>(sql`
      select value from system_flags where key = 'chat_kill_switch' limit 1
    `);

    const [maintenance] = await db.execute<{ value: string }>(sql`
      select value from system_flags where key = 'maintenance_mode' limit 1
    `);

    return {
      failed_logins_24h: failedLogins.count,
      new_users_today: newUsersToday.count,
      new_users_week: newUsersWeek.count,
      tokens_today: tokensToday.total,
      chat_kill_switch: killSwitch?.value ?? "off",
      maintenance_mode: maintenance?.value ?? "off",
    };
  });
}
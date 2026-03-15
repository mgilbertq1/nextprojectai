import { FastifyInstance } from "fastify";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../auth/hooks";

export async function userManagementRoutes(app: FastifyInstance) {

  // ============================================
  // DASHBOARD USER METRICS
  // ============================================
  app.get("/admin/users/metrics", async (request) => {
    await requireAdmin(request);

    const totalUsers = await db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from users
      where deleted_at is null
    `);

    const activeUsers = await db.execute<{ count: number }>(sql`
      select count(distinct user_id)::int as count
      from chats
      where created_at > now() - interval '30 days'
    `);

    const bannedUsers = await db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from users
      where banned = true
        and deleted_at is null
    `);

    const chatUsers = await db.execute<{ count: number }>(sql`
      select count(distinct user_id)::int as count
      from chats
    `);

    return {
      total_users: totalUsers[0]?.count ?? 0,
      active_users: activeUsers[0]?.count ?? 0,
      banned_users: bannedUsers[0]?.count ?? 0,
      total_chat_users: chatUsers[0]?.count ?? 0
    };
  });

  // ============================================
  // USER LIST (Pagination + Search)
  // ============================================
  app.get("/admin/users", async (request) => {
    await requireAdmin(request);

    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all"
    } = request.query as any;

    const offset = (Number(page) - 1) * Number(limit);

    let statusCondition = sql`1=1`;

    if (status === "active") {
      statusCondition = sql`u.banned = false`;
    }

    if (status === "banned") {
      statusCondition = sql`u.banned = true`;
    }

    const users = await db.execute<any>(sql`
      select
        u.id,
        u.email,
        u.role,
        u.banned,
        u.created_at,

        (
          select count(*)
          from chats c
          where c.user_id = u.id
        )::int as total_chats,

        (
          select coalesce(sum(tokens), 0)
          from usage_logs ul
          where ul.user_id = u.id
        )::int as tokens_used,

        (
          select max(c.created_at)
          from chats c
          where c.user_id = u.id
        ) as last_active

      from users u
      where
        u.deleted_at is null
        and u.email ilike ${"%" + search + "%"}
        and ${statusCondition}

      order by u.created_at desc
      limit ${Number(limit)}
      offset ${offset}
    `);

    const total = await db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from users u
      where
        u.deleted_at is null
        and u.email ilike ${"%" + search + "%"}
        and ${statusCondition}
    `);

    return {
      data: users.map((u: any) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        total_chats: u.total_chats,
        tokens_used: u.tokens_used,
        last_active: u.last_active,
        status: u.banned ? "banned" : "active",
        created_at: u.created_at
      })),
      total: total[0]?.count ?? 0,
      page: Number(page),
      limit: Number(limit)
    };
  });

  // ============================================
  // BAN USER
  // ============================================
  app.patch("/admin/users/:id/ban", async (request) => {
    await requireAdmin(request);
    const { id } = request.params as any;

    await db.execute(sql`
      update users
      set banned = true
      where id = ${id}
        and deleted_at is null
    `);

    return { status: "banned" };
  });

  // ============================================
  // UNBAN USER
  // ============================================
  app.patch("/admin/users/:id/unban", async (request) => {
    await requireAdmin(request);
    const { id } = request.params as any;

    await db.execute(sql`
      update users
      set banned = false
      where id = ${id}
        and deleted_at is null
    `);

    return { status: "unbanned" };
  });

  // ============================================
  // SOFT DELETE USER
  // ============================================
  app.delete("/admin/users/:id", async (request) => {
    await requireAdmin(request);
    const { id } = request.params as any;

    await db.execute(sql`
      update users
      set deleted_at = now()
      where id = ${id}
    `);

    return { status: "deleted" };
  });

}
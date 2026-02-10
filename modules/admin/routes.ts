import { FastifyInstance } from "fastify";
import { requireAdmin } from "../auth/hooks";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import type { DbUser } from "../../types/db";

export async function adminRoutes(app: FastifyInstance) {

  // ======================
  // LIST USERS
  // ======================
  app.get("/admin/users", async (request) => {
    await requireAdmin(request);

    const result = await db.execute<DbUser>(sql`
      select * from users
      order by created_at desc
    `);

    return result.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      banned: user.banned,
      created_at: user.created_at,
    }));
  });

  // ======================
  // BAN USER
  // ======================
  app.post("/admin/users/:id/ban", async (request) => {
    const admin = await requireAdmin(request);

    const { id } = request.params as { id: string };

   await db.execute(sql`
  update users
  set banned = ${true}
  where id = ${id}::uuid
`);



    return {
      status: "banned",
      user_id: id,
      by: admin.id,
    };
  });

  // ======================
  // UNBAN USER
  // ======================
  app.post("/admin/users/:id/unban", async (request) => {
    const admin = await requireAdmin(request);

    const { id } = request.params as { id: string };

  await db.execute(sql`
  update users
  set banned = ${false}
  where id = ${id}::uuid
`);



    return {
      status: "unbanned",
      user_id: id,
      by: admin.id,
    };
  });
}
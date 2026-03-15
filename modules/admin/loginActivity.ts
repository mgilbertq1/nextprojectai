import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export async function getLoginActivity(page: number, limit: number) {
  const offset = (page - 1) * limit;

  const data = await db.execute(sql`
    SELECT
      l.id,
      u.email,
      u.role,
      MIN(l.created_at) FILTER (WHERE l.success = true) AS first_login,
      l.method,
      l.success,
      l.created_at
    FROM login_logs l
    LEFT JOIN users u ON u.id = l.user_id
    GROUP BY l.id, u.email, u.role, l.method, l.success, l.created_at
    ORDER BY l.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const totalResult = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM login_logs
  `);

  const total = totalResult[0]?.count ?? 0;

  return {
    data: data.map((row: any) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      method: row.method,
      first_login: row.first_login,
      status: row.success ? "success" : "failed",
      login_at: row.created_at,
    })),
    total,
    page,
    limit,
  };
}

export async function deleteLoginLog(id: string) {
  await db.execute(sql`
    delete from login_logs
    where id = ${id}
  `);
}

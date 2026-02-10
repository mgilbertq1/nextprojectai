import { FastifyRequest } from "fastify";
import { verifyAccessToken } from "../../config/jwt";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import type { DbUser } from "../../types/db";

export async function requireUser(
  request: FastifyRequest
): Promise<DbUser> {
  const token = request.cookies?.access_token;
  if (!token) {
    throw request.server.httpErrors.unauthorized();
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    throw request.server.httpErrors.unauthorized();
  }

  const result = await db.execute<DbUser>(sql`
    select * from users
    where id = ${payload.sub}
    limit 1
  `);

  const user = result[0];

  if (!user || user.banned) {
    throw request.server.httpErrors.unauthorized();
  }

  return user;
}

export async function requireAdmin(
  request: FastifyRequest
): Promise<DbUser> {
  const user = await requireUser(request);

  if (user.role !== "admin") {
    throw request.server.httpErrors.forbidden("Admin only");
  }

  return user;
}

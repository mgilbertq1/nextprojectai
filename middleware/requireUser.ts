import { FastifyRequest } from "fastify";
import { db } from "@/db/drizzle";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAccessToken } from "@/config/jwt";

export type AuthUser = {
  id: string;
  role: string;
};

export async function requireUser(request: FastifyRequest): Promise<AuthUser> {
  const token = request.cookies?.access_token;

  if (!token) {
    throw request.server.httpErrors.unauthorized();
  }

  const payload = verifyAccessToken(token) as { sub: string };

  if (!payload?.sub) {
    throw request.server.httpErrors.unauthorized();
  }

  const result = await db
    .select({
      id: users.id,
      role: users.role,
      banned: users.banned,
    })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  const user = result[0];

  if (!user) {
    throw request.server.httpErrors.unauthorized();
  }

  if (user.banned) {
    throw request.server.httpErrors.forbidden("User banned");
  }

  const authUser: AuthUser = {
    id: user.id,
    role: user.role,
  };

  // attach ke request
  (request as any).user = authUser;

  return authUser;
}

export async function requireAdmin(request: FastifyRequest) {
  const user = await requireUser(request);

  if (user.role !== "admin") {
    throw request.server.httpErrors.forbidden("Admin only");
  }

  return user;
}
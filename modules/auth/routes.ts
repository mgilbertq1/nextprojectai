import { FastifyInstance } from "fastify";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import { verifyPassword, hashPassword } from "../../utils/password";
import { createAccessToken } from "../../config/jwt";
import type { DbUser } from "../../types/db";
import { randomUUID } from "crypto";

export async function authRoutes(app: FastifyInstance) {

  // ======================
  // REGISTER
  // ======================
  app.post("/auth/register", async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      throw app.httpErrors.badRequest("Email and password required");
    }

    // check existing email
    const existing = await db.execute<DbUser>(sql`
      select * from users
      where email = ${email}
      limit 1
    `);

    if (existing.length > 0) {
      throw app.httpErrors.badRequest("Email already registered");
    }

    const passwordHash = await hashPassword(password);
    const userId = randomUUID();

    await db.execute(sql`
      insert into users (id, email, password_hash, role, banned)
      values (
        ${userId},
        ${email},
        ${passwordHash},
        'user',
        false
      )
    `);

    const token = createAccessToken({
      sub: userId,
      role: "user",
    });

    reply.setCookie("access_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // prod: true
      path: "/",
    });

    return { status: "registered" };
  });

  // ======================
  // LOGIN
  // ======================
  app.post("/auth/login", async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    const result = await db.execute<DbUser>(sql`
      select * from users
      where email = ${email}
      limit 1
    `);

    const user = result[0];

    if (!user) {
      throw app.httpErrors.unauthorized("Invalid credentials");
    }

    if (user.banned) {
      throw app.httpErrors.forbidden("User banned");
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      throw app.httpErrors.unauthorized("Invalid credentials");
    }

    const token = createAccessToken({
      sub: user.id,
      role: user.role,
    });

    reply.setCookie("access_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // prod: true
      path: "/",
    });

    return { status: "logged_in" };
  });

  // ======================
  // LOGOUT
  // ======================
  app.post("/auth/logout", async (_, reply) => {
    reply.clearCookie("access_token", { path: "/" });
    return { status: "logged_out" };
  });
}
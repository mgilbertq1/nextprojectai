import { FastifyInstance } from "fastify";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import { verifyPassword, hashPassword } from "../../utils/password";
import { createAccessToken } from "../../config/jwt";
import type { DbUser } from "../../types/db";
import { randomUUID } from "crypto";
import { requireUser } from "./hooks";

async function logLogin({
  userId,
  method,
  success,
  ip,
  userAgent,
}: {
  userId: string | null;
  method: string;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
}) {
  await db.execute(sql`
    insert into login_logs (
      id,
      user_id,
      method,
      success,
      ip_address,
      user_agent,
      created_at
    )
    values (
      ${randomUUID()},
      ${userId},
      ${method},
      ${success},
      ${ip},
      ${userAgent},
      now()
    )
  `);
}

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
      secure: false, // production: true
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

    const ip =
      (request.headers["x-forwarded-for"] as string)?.split(",")[0] ??
      request.ip;

    const userAgent = request.headers["user-agent"] ?? null;

    const result = await db.execute<DbUser>(sql`
      select * from users
      where email = ${email}
      limit 1
    `);

    const user = result[0];

    if (!user) {
      await logLogin({
        userId: null,
        method: "email",
        success: false,
        ip,
        userAgent,
      });

      throw app.httpErrors.unauthorized("Invalid credentials");
    }

    if (user.banned) {
      throw app.httpErrors.forbidden("User banned");
    }

    const ok = await verifyPassword(password, user.password_hash);

    if (!ok) {
      await logLogin({
        userId: user.id,
        method: "email",
        success: false,
        ip,
        userAgent,
      });

      throw app.httpErrors.unauthorized("Invalid credentials");
    }

    const token = createAccessToken({
      sub: user.id,
      role: user.role,
    });

    reply.setCookie("access_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });

    await logLogin({
      userId: user.id,
      method: "email",
      success: true,
      ip,
      userAgent,
    });

    return {
      status: "logged_in",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  });

  // ======================
  // LOGOUT
  // ======================
  app.post("/auth/logout", async (_, reply) => {
    reply.clearCookie("access_token", { path: "/" });
    return { status: "logged_out" };
  });

  // ======================
  // CURRENT USER
  // ======================
  app.get("/auth/me", async (request) => {
    const user = await requireUser(request);

    const result = await db.execute(sql`
      select id, email, role
      from users
      where id = ${user.id}
      limit 1
    `);

    const dbUser = result[0];

    return {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
    };
  });
}
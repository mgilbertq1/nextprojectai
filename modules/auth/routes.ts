import { FastifyInstance } from "fastify";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import { verifyPassword, hashPassword } from "../../utils/password";
import { createAccessToken } from "../../config/jwt";
import type { DbUser } from "../../types/db";
import { randomUUID } from "crypto";
import { requireUser } from "./hooks";

// ─── Email validation ─────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BLOCKED_DOMAINS = [
  "example.com", "test.com", "mailinator.com", "tempmail.com",
  "guerrillamail.com", "throwam.com", "yopmail.com", "sharklasers.com",
  "maildrop.cc", "trashmail.com", "fakeinbox.com", "dispostable.com",
];

function validateEmail(email: string): string | null {
  if (!EMAIL_REGEX.test(email)) return "Format email tidak valid.";
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && BLOCKED_DOMAINS.includes(domain)) return "Gunakan email asli.";
  return null;
}

async function logLogin({
  userId, method, success, ip, userAgent,
}: {
  userId: string | null; method: string; success: boolean;
  ip: string | null; userAgent: string | null;
}) {
  await db.execute(sql`
    insert into login_logs (id, user_id, method, success, ip_address, user_agent, created_at)
    values (${randomUUID()}, ${userId}, ${method}, ${success}, ${ip}, ${userAgent}, now())
  `);
}

export async function authRoutes(app: FastifyInstance) {
  // ======================
  // REGISTER
  // ======================
  app.post("/auth/register", async (request, reply) => {
    const { email, password, name, username } = request.body as {
      email: string; password: string; name?: string; username?: string;
    };

    if (!email || !password) {
      throw app.httpErrors.badRequest("Email and password required");
    }

    // ── Validasi email ──
    const emailError = validateEmail(email);
    if (emailError) throw app.httpErrors.badRequest(emailError);

    const existing = await db.execute<DbUser>(sql`
      select * from users where email = ${email} limit 1
    `);

    if (existing.length > 0) {
      throw app.httpErrors.badRequest("Email already registered");
    }

    const passwordHash = await hashPassword(password);
    const userId = randomUUID();

    await db.execute(sql`
      insert into users (id, email, password_hash, role, banned, name, username)
      values (${userId}, ${email}, ${passwordHash}, 'user', false, ${name ?? null}, ${username ?? null})
    `);

    const token = createAccessToken({ sub: userId, role: "user" });

    reply.setCookie("access_token", token, {
      httpOnly: true, sameSite: "none", secure: true, path: "/",
    });

    return {
      status: "registered",
      user: { id: userId, email, name: name ?? null, username: username ?? null, role: "user" },
    };
  });

  // ======================
  // LOGIN
  // ======================
  app.post("/auth/login", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    const ip = (request.headers["x-forwarded-for"] as string)?.split(",")[0] ?? request.ip;
    const userAgent = request.headers["user-agent"] ?? null;

    const result = await db.execute<DbUser>(sql`
      select * from users where email = ${email} limit 1
    `);

    const user = result[0];

    if (!user) {
      await logLogin({ userId: null, method: "email", success: false, ip, userAgent });
      throw app.httpErrors.unauthorized("Invalid credentials");
    }

    if (user.banned) throw app.httpErrors.forbidden("User banned");

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      await logLogin({ userId: user.id, method: "email", success: false, ip, userAgent });
      throw app.httpErrors.unauthorized("Invalid credentials");
    }

    const token = createAccessToken({ sub: user.id, role: user.role });

    reply.setCookie("access_token", token, {
      httpOnly: true, sameSite: "none", secure: true, path: "/",
    });

    await logLogin({ userId: user.id, method: "email", success: true, ip, userAgent });

    return {
      status: "logged_in",
      user: {
        id: user.id, email: user.email,
        name: user.name ?? null,
        username: user.username ?? null,
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
      select id, email, role, name, username from users where id = ${user.id} limit 1
    `);

    const dbUser = result[0] as any;
    return {
      id: dbUser.id, email: dbUser.email, role: dbUser.role,
      name: dbUser.name ?? null, username: dbUser.username ?? null,
    };
  });
}
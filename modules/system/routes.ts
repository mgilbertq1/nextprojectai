import { FastifyInstance } from "fastify";
import { requireAdmin } from "../auth/hooks";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export async function systemRoutes(app: FastifyInstance) {

  // GET all flags
  app.get("/admin/system/flags", async (request) => {
    await requireAdmin(request);

    const rows = await db.execute<{ key: string; value: string }>(sql`
      select key, value from system_flags
    `);

    // Return as object for easy lookup: { chat_kill_switch: "off", maintenance_mode: "off", ... }
    const flags: Record<string, string> = {};
    for (const row of rows) {
      flags[row.key] = row.value;
    }

    // Ensure defaults exist
    return {
      chat_kill_switch: flags.chat_kill_switch ?? "off",
      maintenance_mode: flags.maintenance_mode ?? "off",
      daily_token_quota: flags.daily_token_quota ?? "50000",
    };
  });

  // UPSERT a flag
  app.post("/admin/system/flags/:key", async (request) => {
    await requireAdmin(request);

    const { key } = request.params as { key: string };
    const { value } = request.body as { value: string };

    await db.execute(sql`
      insert into system_flags (key, value)
      values (${key}, ${value})
      on conflict (key)
      do update set value = excluded.value
    `);

    return { key, value };
  });

  // GET server health
  app.get("/admin/system/health", async (request) => {
    await requireAdmin(request);

    const start = Date.now();

    // Ping DB
    let dbOk = false;
    try {
      await db.execute(sql`select 1`);
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const dbLatency = Date.now() - start;

    return {
      status: dbOk ? "healthy" : "degraded",
      db: {
        connected: dbOk,
        latency_ms: dbLatency,
      },
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      node_version: process.version,
      timestamp: new Date().toISOString(),
    };
  });
}
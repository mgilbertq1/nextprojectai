import { FastifyInstance } from "fastify";
import { db } from "@/db/drizzle";
import { sql } from "drizzle-orm";
import { requireUser } from "../auth/hooks";

export async function settingsRoutes(app: FastifyInstance) {
  // ================================
  // GET USER SETTINGS
  // ================================
  app.get("/settings", async (request) => {
    const user = await requireUser(request);

    const result = await db.execute(sql`
      select
        full_name,
        call_name,
        occupation,
        preferences,
        notify_completion,
        color_mode,
        chat_font,
        search_enabled
      from user_settings
      where user_id = ${user.id}
      limit 1
    `);

    if (!result.length) return null;
    return result[0];
  });

  // ================================
  // SAVE / UPDATE SETTINGS
  // ================================
  app.post("/settings", async (request) => {
    const user = await requireUser(request);

    const {
      fullName, callName, occupation, preferences,
      notifyCompletion, colorMode, chatFont, searchEnabled,
    } = request.body as any;

    // Simpan ke user_settings
    await db.execute(sql`
      insert into user_settings (
        user_id, full_name, call_name, occupation, preferences,
        notify_completion, color_mode, chat_font, search_enabled
      )
      values (
        ${user.id}, ${fullName}, ${callName}, ${occupation}, ${preferences},
        ${notifyCompletion}, ${colorMode}, ${chatFont}, ${searchEnabled}
      )
      on conflict (user_id)
      do update set
        full_name         = excluded.full_name,
        call_name         = excluded.call_name,
        occupation        = excluded.occupation,
        preferences       = excluded.preferences,
        notify_completion = excluded.notify_completion,
        color_mode        = excluded.color_mode,
        chat_font         = excluded.chat_font,
        search_enabled    = excluded.search_enabled,
        updated_at        = now()
    `);

    // Update nama di tabel users
    await db.execute(sql`
      update users
      set name = ${fullName}, username = ${callName}
      where id = ${user.id}
    `);

    // ── DIHAPUS: jangan insert preferences ke tabel memories ──────────────────
    // Preferences disimpan di user_settings.preferences
    // Memories dikelola terpisah via /memories endpoints

    return { status: "saved" };
  });

  // ================================
  // RESET SETTINGS
  // ================================
  app.delete("/settings", async (request) => {
    const user = await requireUser(request);

    await db.execute(sql`
      delete from user_settings where user_id = ${user.id}
    `);

    return { status: "reset" };
  });
}
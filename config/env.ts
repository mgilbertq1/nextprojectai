// config/env.ts — tambahkan RESEND_API_KEY + Supabase Storage
import "dotenv/config";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const env = {
  // existing
  DATABASE_URL: must("DATABASE_URL"),
  JWT_SECRET:   must("JWT_SECRET"),
  PORT:         Number(process.env.PORT ?? 3000),
  NODE_ENV:     process.env.NODE_ENV ?? "development",
  GROK_API_KEY: must("XAI_API_KEY"),

  // ─── NEW: Support ticket / email ─────────────────────────────
  RESEND_API_KEY:         must("RESEND_API_KEY"),
  SUPPORT_FROM_EMAIL:     process.env.SUPPORT_FROM_EMAIL ?? "support@LyraAI.com",
  SUPABASE_URL:           must("SUPABASE_URL"),
  SUPABASE_SERVICE_KEY:   must("SUPABASE_SERVICE_KEY"),
};

// ─── .env additions ───────────────────────────────────────────
// Tambahkan ke .env kamu:
//
// RESEND_API_KEY=re_xxxxxxxxxxxx
// SUPPORT_FROM_EMAIL=support@yourdomain.com   ← domain yang sudah verify di Resend
// SUPABASE_URL=https://xxxx.supabase.co
// SUPABASE_SERVICE_KEY=eyJhbGci...            ← service_role key (bukan anon key!)
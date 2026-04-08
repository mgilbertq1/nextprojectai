import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export async function getSystemPrompt(): Promise<string> {
  const rows = await db.execute<{ content: string }>(sql`
    SELECT content FROM system_prompts
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  return rows[0]?.content ?? "";
}

export async function updateSystemPrompt(content: string): Promise<void> {
  const existing = await db.execute(sql`
    SELECT id FROM system_prompts LIMIT 1
  `);

  if (existing.length) {
    await db.execute(sql`
      UPDATE system_prompts
      SET content = ${content}, updated_at = now()
    `);
  } else {
    await db.execute(sql`
      INSERT INTO system_prompts (content)
      VALUES (${content})
    `);
  }
}
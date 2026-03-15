import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export async function getMemoryContext(userId: string): Promise<string> {

  const rows = await db.execute<{ content: string }>(sql`
    select content
    from memories
    where user_id = ${userId}
    order by updated_at desc
    limit 20
  `);

  if (!rows.length) return "";

  const text = rows
    .map((m) => `- ${m.content}`)
    .join("\n");

  return `
User long-term memory:
${text}
`;
}
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function saveExtractedMemories(
  userId: string,
  memories: string[],
) {
  if (!memories.length) return;

  for (const memory of memories) {
    await db.execute(sql`
insert into memories (id, user_id, content)
select ${randomUUID()}, ${userId}, ${memory}
where not exists (
  select 1
  from memories
  where user_id = ${userId}
  and content = ${memory}
)
`);
  }
}

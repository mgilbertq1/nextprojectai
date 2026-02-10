import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function getRecentChatHistory(
  userId: string,
  limit: number = 10
): Promise<ChatMessage[]> {

  const rows = await db.execute<ChatMessage>(sql`
    select role, content
    from chats
    where user_id = ${userId}
    order by created_at desc
    limit ${limit}
  `);

  // reverse so oldest → newest
  return rows.reverse();
}

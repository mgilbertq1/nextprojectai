import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function getRecentChatHistory(
  userId: string,
  limit: number,
  conversationId: string
): Promise<ChatMessage[]> {
  const result = await db.execute<{ role: string; content: string }>(sql`
    select role, content
    from chats
    where user_id = ${userId}
      and conversation_id = ${conversationId}
    order by created_at desc
    limit ${limit}
  `);

  return result
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}
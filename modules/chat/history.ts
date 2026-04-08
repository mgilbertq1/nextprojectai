import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
};

export async function getRecentChatHistory(
  userId: string,
  limit: number,
  conversationId: string
): Promise<ChatMessage[]> {
  const result = await db.execute<{ role: string; content: string; image_url: string | null }>(sql`
    select role, content, image_url
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
      image_url: m.image_url,
    }));
}
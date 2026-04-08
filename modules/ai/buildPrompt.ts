import { getSystemPrompt } from "./systemPrompt";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import type { ChatMessage } from "../chat/history";

export async function buildPrompt(
  userId: string,
  conversationId: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const [systemPrompt, settings, memories, summaryResult] = await Promise.all([
    getSystemPrompt(),

    db.execute<{ call_name: string | null; occupation: string | null }>(sql`
      select call_name, occupation
      from user_settings
      where user_id = ${userId}
      limit 1
    `),

    db.execute<{ content: string }>(sql`
      select content
      from memories
      where user_id = ${userId}
      order by updated_at desc
      limit 5
    `),

    db.execute<{ content: string }>(sql`
      select content
      from conversation_summaries
      where user_id = ${userId}
        and conversation_id = ${conversationId}
      limit 1
    `),
  ]);

  const userProfile = settings[0]
    ? `Name: ${settings[0].call_name ?? "User"}
Occupation: ${settings[0].occupation ?? "Unknown"}`
    : "";

  const memoryText = memories.length
    ? memories.map((m) => `- ${m.content}`).join("\n")
    : "";

  const summaryText = summaryResult[0]?.content ?? "";

  const historyText = history
    .slice(-8)
    .map((m) =>
      m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`,
    )
    .join("\n");

  return `
${systemPrompt}

=== USER PROFILE ===
${userProfile}

=== USER MEMORY ===
${memoryText}

=== CONVERSATION SUMMARY ===
${summaryText}

=== RECENT CONVERSATION ===
${historyText}

User: ${userMessage}
Assistant:
`;
}
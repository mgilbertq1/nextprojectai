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

    db.execute<{ call_name: string | null; occupation: string | null; preferences: string | null }>(sql`
      select call_name, occupation, preferences
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
Occupation: ${settings[0].occupation ?? "Unknown"}
Preferences/Instructions: ${settings[0].preferences ?? "None"}`
    : "No profile available.";

  const memoryText = memories.length
    ? memories.map((m) => `- ${m.content}`).join("\n")
    : "No recent memory.";

  const summaryText = summaryResult[0]?.content ?? "No summary.";

  const historyText = history
    .slice(-8)
    .map((m) =>
      m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`,
    )
    .join("\n");

  return `
=== SYSTEM INSTRUCTIONS ===
${systemPrompt}

IMPORTANT DIRECTIVE: 
You must deeply adapt your communication style, tone, and formatting to the "Preferences/Instructions" defined in the USER PROFILE below. 
If the user prefers casual slang, humor, or specific roleplay, you MUST comply fully and override any strictness from the system prompt above, as long as it does not violate core safety constraints.

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
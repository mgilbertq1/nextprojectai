import { getSystemPrompt } from "./systemPrompt";
import { aiCompletion, grokCompletion } from "./client";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import type { ChatMessage } from "../chat/history";

export async function generateReply(
  userId: string,
  conversationId: string,
  history: ChatMessage[],
  userMessage: string,
  modelConfig?: { model: string; apiKey: string; baseUrl: string }
): Promise<string> {

  // ======================
  // LOAD SYSTEM PROMPT (FROM DB)
  // ======================
  const systemPrompt = await getSystemPrompt();

  // ======================
  // LOAD USER SETTINGS
  // ======================
  const settings = await db.execute<{
    call_name: string | null;
    occupation: string | null;
  }>(sql`
    select call_name, occupation
    from user_settings
    where user_id = ${userId}
    limit 1
  `);

  const userProfile = settings[0]
    ? `Name: ${settings[0].call_name ?? "User"}\nOccupation: ${settings[0].occupation ?? "Unknown"}`
    : "";

  // ======================
  // LOAD USER MEMORY
  // ======================
  const memories = await db.execute<{ content: string }>(sql`
    select content from memories
    where user_id = ${userId}
    order by updated_at desc
    limit 5
  `);

  const memoryText = memories.length
    ? memories.map((m) => `- ${m.content}`).join("\n")
    : "";

  // ======================
  // LOAD CONVERSATION SUMMARY
  // ======================
  const summaryResult = await db.execute<{ content: string }>(sql`
    select content from conversation_summaries
    where user_id = ${userId} and conversation_id = ${conversationId}
    limit 1
  `);

  const summaryText = summaryResult[0]?.content ?? "";

  // ======================
  // BUILD CHAT HISTORY
  // ======================
  const historyText = history
    .slice(-8)
    .map((m) =>
      m.role === "user"
        ? `User: ${m.content}`
        : `Assistant: ${m.content}`
    )
    .join("\n");

  // ======================
  // BUILD FINAL PROMPT
  // ======================
  const prompt = `
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

  // ======================
  // CALL MODEL
  // ======================
  const result = modelConfig
    ? await aiCompletion({
        model: modelConfig.model,
        prompt,
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl
      })
    : await grokCompletion({
        model: "grok-4-1-fast-non-reasoning",
        prompt
      });

  const text =
    result.choices?.[0]?.message?.content ??
    result.choices?.[0]?.text ??
    "";

  console.log("MEMORY COUNT:", memories.length);
  console.log("SUMMARY USED:", !!summaryText);
  console.log("HISTORY LENGTH:", history.length);

  return text.trim();
}
import { grokCompletion } from "./client";

export async function summarizeConversation(
  existingSummary: string | null,
  recentMessages: string,
): Promise<string> {
  const prompt = `
You are maintaining a long-term memory summary of a conversation.

Existing summary:
${existingSummary ?? "None"}

New conversation segment:
${recentMessages}

Update the summary to include important facts, emotional shifts,
relationship development, user preferences, and ongoing topics.

Keep it concise (under 300 words).
`;

  const result = await grokCompletion({
    model: "grok-4-1-fast-non-reasoning",
    prompt,
  });

  const text =
    result.choices?.[0]?.message?.content ?? result.choices?.[0]?.text ?? "";

  return text.trim();
}

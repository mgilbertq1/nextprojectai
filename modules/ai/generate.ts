import { SYSTEM_PROMPT } from "./systemPrompt";
import { grokCompletion } from "./client";
import type { ChatMessage } from "../chat/history";

export async function generateReply(
  history: ChatMessage[],
  userMessage: string
): Promise<string> {

  const historyText = history
    .map((m) =>
      m.role === "user"
        ? `User: ${m.content}`
        : `Assistant: ${m.content}`
    )
    .join("\n");

  const prompt = `
${SYSTEM_PROMPT}

${historyText}

User: ${userMessage}
Assistant:
`;

  const result = await grokCompletion({
    model: "grok-4-1-fast-non-reasoning",
    prompt,
  });

  const text =
    result.choices?.[0]?.message?.content ??
    result.choices?.[0]?.text ??
    "";

  return text.trim();
}

import { grokCompletion } from "./client";

export async function generateConversationTitle(
  message: string,
): Promise<string> {
  const prompt = `
Generate a very short conversation title (max 6 words).

Message:
${message}

Title:
`;

  const result = await grokCompletion({
    model: "grok-4-1-fast-non-reasoning",
    prompt,
  });

  const text =
    result.choices?.[0]?.message?.content ??
    result.choices?.[0]?.text ??
    "New conversation";

  return text.trim().replace(/["']/g, "").replace(/\n/g, "").slice(0, 60);
}

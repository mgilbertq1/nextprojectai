import { grokCompletion } from "../ai/client";

export async function extractMemories(message: string): Promise<string[]> {

  const prompt = `
You detect long-term user memories.

Extract only facts worth remembering long-term.

Examples:
- user name
- preferences
- occupation
- goals
- personal traits
- recurring interests

Return JSON array of short memory strings.

Message:
${message}

Example output:
["User prefers Python", "User works as a developer"]

If nothing important return [].
`;

  const result = await grokCompletion({
    model: "grok-4-1-fast-non-reasoning",
    prompt
  });

  const text =
    result.choices?.[0]?.message?.content ??
    result.choices?.[0]?.text ??
    "[]";

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
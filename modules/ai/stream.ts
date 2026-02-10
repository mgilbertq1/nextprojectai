import { grokStream } from "./client";

export async function streamReply(
  message: string,
  onToken: (token: string) => void
): Promise<string> {

  const stream = await grokStream({
    model: "grok-4-1-fast-non-reasoning",
    prompt: message
  });

  let fullText = "";
  let buffer = "";

  for await (const chunk of stream as any) {
    buffer += chunk.toString();

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;

      const data = line.replace("data:", "").trim();

      if (data === "[DONE]") {
        return fullText.trim();
      }

      try {
        const json = JSON.parse(data);

        const token =
          json.choices?.[0]?.message?.content;

        if (token) {
          fullText += token;
          onToken(token);
        }
      } catch {
      }
    }
  }

  return fullText.trim();
}

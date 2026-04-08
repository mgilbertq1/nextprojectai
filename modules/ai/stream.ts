import { aiStream, grokStream } from "./client";

export async function streamReply(
  prompt: string,
  onToken: (token: string) => void,
  modelConfig?: { model: string; apiKey: string; baseUrl: string },
  imageBase64?: string
): Promise<string> {

  const stream = modelConfig
    ? await aiStream({ model: modelConfig.model, prompt, apiKey: modelConfig.apiKey, baseUrl: modelConfig.baseUrl, imageBase64 })
    : await grokStream({ model: "grok-4-1-fast-non-reasoning", prompt, imageBase64 });

  let fullText = "";
  let buffer = "";

  for await (const chunk of stream as any) {
    buffer += Buffer.from(chunk).toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.replace("data:", "").trim();
      if (data === "[DONE]") return fullText.trim();

      try {
        const json = JSON.parse(data);
        const token =
          json?.choices?.[0]?.delta?.content ??
          json?.choices?.[0]?.message?.content ??
          json?.choices?.[0]?.text ??
          "";
        if (!token) continue;
        fullText += token;
        onToken(token);
      } catch {}
    }
  }

  return fullText.trim();
}
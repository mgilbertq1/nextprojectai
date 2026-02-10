import { env } from "../../config/env";

const BASE = "https://api.x.ai/v1";

// ==========================
// NON-STREAMING
// ==========================
export async function grokCompletion(props: {
  model: string;
  prompt: string;
}) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: props.model,
      messages: [
        { role: "user", content: props.prompt }
      ],
      temperature: 0.7
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok API error: ${text}`);
  }

  return (await res.json()) as import("./types").GrokChatResponse;
}

// ==========================
// STREAMING
// ==========================
export async function grokStream(props: {
  model: string;
  prompt: string;
}) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: props.model,
      messages: [{ role: "user", content: props.prompt }],
      stream: true
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.body;
}


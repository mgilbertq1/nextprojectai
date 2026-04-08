// ==========================
// NON-STREAMING
// ==========================
export async function aiCompletion(props: {
  model: string;
  prompt: string;
  apiKey: string;
  baseUrl: string;
  imageBase64?: string;
}) {
  const content = props.imageBase64
    ? [
        { type: "text", text: props.prompt },
        { type: "image_url", image_url: { url: props.imageBase64 } },
      ]
    : props.prompt;

  const res = await fetch(`${props.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${props.apiKey}`,
    },
    body: JSON.stringify({
      model: props.model,
      messages: [{ role: "user", content }],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI API error: ${text}`);
  }

  return (await res.json()) as import("./types").GrokChatResponse;
}

// ==========================
// STREAMING
// ==========================
export async function aiStream(props: {
  model: string;
  prompt: string;
  apiKey: string;
  baseUrl: string;
  imageBase64?: string;
}) {
  const content = props.imageBase64
    ? [
        { type: "text", text: props.prompt },
        { type: "image_url", image_url: { url: props.imageBase64 } },
      ]
    : props.prompt;

  const res = await fetch(`${props.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${props.apiKey}`,
    },
    body: JSON.stringify({
      model: props.model,
      messages: [{ role: "user", content }],
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.body;
}

// ==========================
// LEGACY GROK (fallback)
// ==========================
import { env } from "../../config/env";

export async function grokCompletion(props: { model: string; prompt: string; imageBase64?: string }) {
  return aiCompletion({
    model: props.model,
    prompt: props.prompt,
    apiKey: env.GROK_API_KEY,
    baseUrl: "https://api.x.ai/v1",
    imageBase64: props.imageBase64,
  });
}

export async function grokStream(props: { model: string; prompt: string; imageBase64?: string }) {
  return aiStream({
    model: props.model,
    prompt: props.prompt,
    apiKey: env.GROK_API_KEY,
    baseUrl: "https://api.x.ai/v1",
    imageBase64: props.imageBase64,
  });
}
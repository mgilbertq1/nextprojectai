import { FastifyInstance } from "fastify";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

import { requireUser } from "../auth/hooks";
import { requireChatEnabled } from "../system/guards";
import { logUsage } from "../usage/logger";

import { generateReply } from "../ai/generate";
import { summarizeConversation } from "../ai/summarizer";
import { getRecentChatHistory } from "./history";
import { chunkText } from "../ai/chunker";
import { enforceDailyQuota, estimateTokens, getUserQuotaUsage } from "../usage/quota";
import { getEnabledModels, getModelById, getDefaultModel } from "../admin/aiModels";
import { generateConversationTitle } from "../ai/title";
import { extractMemories } from "../memory/extractMemory";
import { saveExtractedMemories } from "../memory/saveExtractedMemories";
import { buildPrompt } from "../ai/buildPrompt";
import { streamReply } from "../ai/stream";

export async function maybeUpdateSummary(
  userId: string,
  conversationId: string,
) {
  try {
    const userCountResult = await db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from chats
      where user_id = ${userId}
        and conversation_id = ${conversationId}
        and role = 'user'
    `);

    const userMessages = userCountResult[0]?.count ?? 0;

    console.log("USER MESSAGE COUNT:", userMessages);

    if (userMessages < 5 || userMessages % 5 !== 0) {
      return;
    }

    const recent = await db.execute<{ role: string; content: string }>(sql`
      select role, content
      from chats
      where user_id = ${userId}
        and conversation_id = ${conversationId}
      order by created_at desc
      limit 10
    `);

    if (!recent.length) return;

    const recentText = recent
      .reverse()
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const existing = await db.execute<{ content: string }>(sql`
      select content
      from conversation_summaries
      where user_id = ${userId}
        and conversation_id = ${conversationId}
      limit 1
    `);

    const existingSummary = existing[0]?.content ?? null;

    const newSummary = await summarizeConversation(existingSummary, recentText);

    if (existingSummary) {
      await db.execute(sql`
        update conversation_summaries
        set content = ${newSummary},
            updated_at = now()
        where user_id = ${userId}
          and conversation_id = ${conversationId}
      `);
    } else {
      await db.execute(sql`
        insert into conversation_summaries (
          id, user_id, conversation_id, content
        )
        values (
          ${randomUUID()}, ${userId}, ${conversationId}, ${newSummary}
        )
      `);
    }

    console.log("SUMMARY UPDATED:", userId, conversationId);
  } catch (err) {
    console.error("SUMMARY UPDATE FAILED", err);
  }
}

export async function chatRoutes(app: FastifyInstance) {
  // ================= NON-STREAM =================
  app.post("/chat", async (request) => {
    const user = await requireUser(request);
    await requireChatEnabled(request);

    const { message, conversationId } = request.body as {
      message: string;
      conversationId?: string;
    };

    if (!message) {
      throw app.httpErrors.badRequest("Message required");
    }

    try {
      await enforceDailyQuota(user.id, user.role);
    } catch {
      throw app.httpErrors.tooManyRequests("Daily token limit exceeded. Resets at midnight UTC.");
    }

    let convoId = conversationId;

    if (!convoId) {
      convoId = randomUUID();
      const title = await generateConversationTitle(message);
      await db.execute(sql`
        insert into conversations (id, user_id, title)
        values (${convoId}, ${user.id}, ${title})
      `);
    }

    await db.execute(sql`
      insert into chats (id, user_id, conversation_id, role, content)
      values (${randomUUID()}, ${user.id}, ${convoId}, 'user', ${message})
    `);

    if (message.length > 20) {
      extractMemories(message)
        .then((memories) => saveExtractedMemories(user.id, memories))
        .catch(() => {});
    }

    const history = await getRecentChatHistory(user.id, 10, convoId);
    const replyText = await generateReply(user.id, convoId, history, message);

    await db.execute(sql`
      insert into chats (id, user_id, conversation_id, role, content)
      values (${randomUUID()}, ${user.id}, ${convoId}, 'assistant', ${replyText})
    `);

    // Log usage — estimate tokens from both input and output
    const totalTokens = estimateTokens(message) + estimateTokens(replyText);
    logUsage(user.id, "/chat", totalTokens, "grok-4.1").catch(() => {});

    maybeUpdateSummary(user.id, convoId).catch(() => {});

    return {
      reply: replyText,
      conversationId: convoId,
    };
  });

  // ================= STREAM =================
  app.post("/chat/stream", async (request, reply) => {
    const user = await requireUser(request);
    await requireChatEnabled(request);

    const { message, conversationId, modelId, imageBase64 } = request.body as {
      message: string;
      conversationId?: string;
      modelId?: string;
      imageBase64?: string;
    };

    if (!message) {
      throw app.httpErrors.badRequest("Message required");
    }

    try {
      await enforceDailyQuota(user.id, user.role);
    } catch {
      throw app.httpErrors.tooManyRequests("Daily token limit exceeded. Resets at midnight UTC.");
    }

    // Resolve model config
    const modelRow = modelId
      ? await getModelById(modelId)
      : await getDefaultModel();

    // Reject if model not found or disabled
    if (!modelRow) {
      throw app.httpErrors.serviceUnavailable("No AI model available. Please contact administrator.");
    }
    if (!modelRow.enabled) {
      throw app.httpErrors.forbidden("The selected model is currently disabled.");
    }

    const modelConfig = { model: modelRow.model_id, apiKey: modelRow.api_key, baseUrl: modelRow.base_url };
    const modelName = modelRow.name;

    let convoId = conversationId;

    if (!convoId) {
      convoId = randomUUID();
      const title = await generateConversationTitle(message);
      await db.execute(sql`
        insert into conversations (id, user_id, title)
        values (${convoId}, ${user.id}, ${title})
      `);
    }

    const userMsgId = randomUUID();
    if (imageBase64) {
      await db.execute(sql`
        insert into chats (id, user_id, conversation_id, role, content, image_url)
        values (${userMsgId}, ${user.id}, ${convoId}, 'user', ${message}, ${imageBase64})
      `);
    } else {
      await db.execute(sql`
        insert into chats (id, user_id, conversation_id, role, content)
        values (${userMsgId}, ${user.id}, ${convoId}, 'user', ${message})
      `);
    }

    if (message.length > 20) {
      extractMemories(message)
        .then((memories) => saveExtractedMemories(user.id, memories))
        .catch(() => {});
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": request.headers.origin || "http://localhost:3000",
      "Access-Control-Allow-Credentials": "true",
      "X-Accel-Buffering": "no",
    });

    const history = await getRecentChatHistory(user.id, 10, convoId);
    const prompt = await buildPrompt(user.id, convoId, history, message);

    let finalText = "";

    await streamReply(prompt, (token) => {
      finalText += token;
      reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
    }, modelConfig, imageBase64);

    // ← UPDATED: simpan ai_model_id per assistant message
    await db.execute(sql`
      insert into chats (id, user_id, conversation_id, role, content, ai_model_id)
      values (${randomUUID()}, ${user.id}, ${convoId}, 'assistant', ${finalText}, ${modelRow.id})
    `);

    // Log usage — estimate tokens from both input and output
    const totalTokens = estimateTokens(message) + estimateTokens(finalText);
    logUsage(user.id, "/chat/stream", totalTokens, modelName).catch(() => {});

    maybeUpdateSummary(user.id, convoId).catch(() => {});

    reply.raw.write(
      `event: meta\ndata: ${JSON.stringify({ conversationId: convoId })}\n\n`,
    );
    reply.raw.write("event: done\ndata: end\n\n");
    reply.raw.end();
  });

  // ================= AVAILABLE MODELS =================
  app.get("/chat/models", async (request) => {
    await requireUser(request);
    return getEnabledModels();
  });

  // ================= QUOTA USAGE =================
  app.get("/chat/quota", async (request) => {
    const user = await requireUser(request);
    return getUserQuotaUsage(user.id);
  });

  app.get("/chat/history", async (request) => {
    const user = await requireUser(request);

    const { conversationId } = request.query as { conversationId?: string };

    if (!conversationId) {
      throw app.httpErrors.badRequest("conversationId required");
    }

    const messages = await db.execute(sql`
      select id, role, content, image_url
      from chats
      where user_id = ${user.id}
        and conversation_id = ${conversationId}
      order by created_at asc
    `);

    return messages;
  });

  app.get("/chat/conversations", async (request) => {
    const user = await requireUser(request);

    const { limit = 20, offset = 0 } = request.query as {
      limit?: number;
      offset?: number;
    };

    const result = await db.execute(sql`
      select id, title, archived, created_at
      from conversations
      where user_id = ${user.id}
        and archived = false
      order by created_at desc
      limit ${limit}
      offset ${offset}
    `);

    return result;
  });

  app.delete("/chat/conversations/:id", async (request, reply) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };

    const existing = await db.execute(sql`
      select id from conversations
      where id = ${id} and user_id = ${user.id}
      limit 1
    `);

    if (!existing.length) {
      throw request.server.httpErrors.notFound("Conversation not found");
    }

    await db.execute(sql`delete from chats where conversation_id = ${id}`);
    await db.execute(sql`delete from conversations where id = ${id}`);

    return { status: "deleted" };
  });

  app.post("/chat/conversations/:id/archive", async (request, reply) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };

    await db.execute(sql`
      update conversations set archived = true
      where id = ${id} and user_id = ${user.id}
    `);

    return { status: "archived" };
  });

  app.post("/chat/conversations/:id/unarchive", async (request, reply) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };

    await db.execute(sql`
      update conversations set archived = false
      where id = ${id} and user_id = ${user.id}
    `);

    return { status: "unarchived" };
  });

  // ================= DELETE MESSAGE (+ all after it) =================
  app.delete("/chat/messages/:messageId", async (request, reply) => {
    const user = await requireUser(request);
    const { messageId } = request.params as { messageId: string };

    // Get the target message to find its created_at timestamp & conversation_id
    const target = await db.execute<{ created_at: string; conversation_id: string }>(sql`
      select created_at, conversation_id
      from chats
      where id = ${messageId}
        and user_id = ${user.id}
      limit 1
    `);

    if (!target.length) {
      throw app.httpErrors.notFound("Message not found");
    }

    const { created_at, conversation_id } = target[0];

    // Delete the message + everything after it in the same conversation
    await db.execute(sql`
      delete from chats
      where conversation_id = ${conversation_id}
        and user_id = ${user.id}
        and created_at >= ${created_at}
    `);

    return { status: "deleted" };
  });

  // ================= REWIND MESSAGE (delete + return content for editing) =================
  app.delete("/chat/messages/:messageId/rewind", async (request, reply) => {
    const user = await requireUser(request);
    const { messageId } = request.params as { messageId: string };

    // Get the target message
    const target = await db.execute<{ created_at: string; conversation_id: string; content: string; image_url: string | null }>(sql`
      select created_at, conversation_id, content, image_url
      from chats
      where id = ${messageId}
        and user_id = ${user.id}
      limit 1
    `);

    if (!target.length) {
      throw app.httpErrors.notFound("Message not found");
    }

    const { created_at, conversation_id, content, image_url } = target[0];

    // Delete the message + everything after it in the same conversation
    await db.execute(sql`
      delete from chats
      where conversation_id = ${conversation_id}
        and user_id = ${user.id}
        and created_at >= ${created_at}
    `);

    return { status: "rewound", content, image_url };
  });
}
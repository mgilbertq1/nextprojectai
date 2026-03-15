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
import { enforceDailyQuota, estimateTokens } from "../usage/quota";
import { generateConversationTitle } from "../ai/title";
import { extractMemories } from "../memory/extractMemory";
import { saveExtractedMemories } from "../memory/saveExtractedMemories";

export async function maybeUpdateSummary(
  userId: string,
  conversationId: string,
) {
  try {
    // count user messages in this conversation
    const userCountResult = await db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from chats
      where user_id = ${userId}
        and conversation_id = ${conversationId}
        and role = 'user'
    `);

    const userMessages = userCountResult[0]?.count ?? 0;

    console.log("USER MESSAGE COUNT:", userMessages);

    // only trigger every 5 user messages
    if (userMessages < 5 || userMessages % 5 !== 0) {
      return;
    }

    // get last 10 messages from this conversation
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

    // get existing summary
    const existing = await db.execute<{ content: string }>(sql`
      select content
      from conversation_summaries
      where user_id = ${userId}
        and conversation_id = ${conversationId}
      limit 1
    `);

    const existingSummary = existing[0]?.content ?? null;

    // generate updated summary
    const newSummary = await summarizeConversation(existingSummary, recentText);

    // update or insert
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
          id,
          user_id,
          conversation_id,
          content
        )
        values (
          ${randomUUID()},
          ${userId},
          ${conversationId},
          ${newSummary}
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

    let convoId = conversationId;

    // Create conversation if not exist
    if (!convoId) {
      convoId = randomUUID();

      const title = await generateConversationTitle(message);

      await db.execute(sql`
        insert into conversations (id, user_id, title)
        values (${convoId}, ${user.id}, ${title})
      `);
    }

    // save user message
    await db.execute(sql`
      insert into chats (id, user_id, conversation_id, role, content)
      values (${randomUUID()}, ${user.id}, ${convoId}, 'user', ${message})
    `);

    // memory extraction (non-blocking)
    // memory extraction (non-blocking)
    if (message.length > 20) {
      extractMemories(message)
        .then((memories) => saveExtractedMemories(user.id, memories))
        .catch(() => {});
    }

    // load history
    const history = await getRecentChatHistory(user.id, 10, convoId);

    // generate AI reply
    const replyText = await generateReply(user.id, convoId, history, message);

    // save AI reply
    await db.execute(sql`
      insert into chats (id, user_id, conversation_id, role, content)
      values (${randomUUID()}, ${user.id}, ${convoId}, 'assistant', ${replyText})
    `);

    // optional: update summary
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

    const { message, conversationId } = request.body as {
      message: string;
      conversationId?: string;
    };

    if (!message) {
      throw app.httpErrors.badRequest("Message required");
    }

    let convoId = conversationId;

    // create conversation if needed
    if (!convoId) {
      convoId = randomUUID();

      const title = await generateConversationTitle(message);

      await db.execute(sql`
      insert into conversations (id, user_id, title)
      values (${convoId}, ${user.id}, ${title})
    `);
    }

    // save user message
    await db.execute(sql`
    insert into chats (id, user_id, conversation_id, role, content)
    values (${randomUUID()}, ${user.id}, ${convoId}, 'user', ${message})
  `);

    // memory extraction (async, non-blocking)
    if (message.length > 20) {
      extractMemories(message)
        .then((memories) => saveExtractedMemories(user.id, memories))
        .catch(() => {});
    }

    // start SSE
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "http://localhost:3000",
      "Access-Control-Allow-Credentials": "true",
      "X-Accel-Buffering": "no",
    });

    // load conversation history
    const history = await getRecentChatHistory(user.id, 10, convoId);

    // generate reply
    const replyText = await generateReply(user.id, convoId, history, message);

    const chunks = chunkText(replyText, "word");

    let finalText = "";

    // stream tokens
    for (const chunk of chunks) {
      finalText += chunk;
      reply.raw.write(`data: ${chunk}\n\n`);
      await new Promise((r) => setTimeout(r, 25));
    }

    // save assistant message
    await db.execute(sql`
    insert into chats (id, user_id, conversation_id, role, content)
    values (${randomUUID()}, ${user.id}, ${convoId}, 'assistant', ${finalText})
  `);

    // update conversation summary (async)
    maybeUpdateSummary(user.id, convoId).catch(() => {});

    // send meta event
    reply.raw.write(
      `event: meta\ndata: ${JSON.stringify({ conversationId: convoId })}\n\n`,
    );

    reply.raw.write("event: done\ndata: end\n\n");
    reply.raw.end();
  });

  app.get("/chat/history", async (request) => {
    const user = await requireUser(request);

    const { conversationId } = request.query as {
      conversationId?: string;
    };

    if (!conversationId) {
      throw app.httpErrors.badRequest("conversationId required");
    }

    const messages = await db.execute(sql`
    select id, role, content
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
    select id
    from conversations
    where id = ${id}
      and user_id = ${user.id}
    limit 1
  `);

    if (!existing.length) {
      throw request.server.httpErrors.notFound("Conversation not found");
    }

    await db.execute(sql`
    delete from chats
    where conversation_id = ${id}
  `);

    await db.execute(sql`
    delete from conversations
    where id = ${id}
  `);

    return { status: "deleted" };
  });

  // ================= ARCHIVE CONVERSATION =================
  app.post("/chat/conversations/:id/archive", async (request, reply) => {
    const user = await requireUser(request);

    const { id } = request.params as { id: string };

    await db.execute(sql`
    update conversations
    set archived = true
    where id = ${id}
      and user_id = ${user.id}
  `);

    return { status: "archived" };
  });

  // ================= UNARCHIVE =================
  app.post("/chat/conversations/:id/unarchive", async (request, reply) => {
    const user = await requireUser(request);

    const { id } = request.params as { id: string };

    await db.execute(sql`
    update conversations
    set archived = false
    where id = ${id}
      and user_id = ${user.id}
  `);

    return { status: "unarchived" };
  });
}

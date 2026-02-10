import { FastifyInstance } from "fastify";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

import { requireUser } from "../auth/hooks";
import { requireChatEnabled } from "../system/guards";
import { logUsage } from "../usage/logger";

import { generateReply } from "../ai/generate";
import { getRecentChatHistory } from "./history";
import { chunkText } from "../ai/chunker";

export async function chatRoutes(app: FastifyInstance) {

  // =====================================================
  // NON-STREAMING CHAT
  // =====================================================
  app.post("/chat", async (request) => {
    const user = await requireUser(request);
    await requireChatEnabled(request);

    const { message } = request.body as { message: string };

    if (!message) {
      throw app.httpErrors.badRequest("Message required");
    }

    // save user message
    await db.execute(sql`
      insert into chats (id, user_id, role, content)
      values (
        ${randomUUID()},
        ${user.id},
        'user',
        ${message}
      )
    `);

    // get recent history
    const history = await getRecentChatHistory(user.id, 10);

    // generate AI reply with history
    const replyText = await generateReply(history, message);

    // save assistant reply
    await db.execute(sql`
      insert into chats (id, user_id, role, content)
      values (
        ${randomUUID()},
        ${user.id},
        'assistant',
        ${replyText}
      )
    `);

    await logUsage(user.id, "/chat", 0);

    return {
      reply: replyText,
    };
  });

  // =====================================================
  // STREAMING CHAT (PSEUDO STREAMING)
  // =====================================================
  app.post("/chat/stream", async (request, reply) => {
    const user = await requireUser(request);
    await requireChatEnabled(request);

    const { message } = request.body as { message: string };

    if (!message) {
      throw app.httpErrors.badRequest("Message required");
    }

    // save user message
    await db.execute(sql`
      insert into chats (id, user_id, role, content)
      values (
        ${randomUUID()},
        ${user.id},
        'user',
        ${message}
      )
    `);

    // SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // get recent history
    const history = await getRecentChatHistory(user.id, 10);

    // generate full AI reply (non-stream)
    const replyText = await generateReply(history, message);

    // split into chunks (natural typing)
    const chunks = chunkText(replyText, "word");

    let finalText = "";

    for (const chunk of chunks) {
      finalText += chunk;
      reply.raw.write(`data: ${chunk}\n\n`);
      await new Promise((r) => setTimeout(r, 25)); // typing speed
    }

    // save assistant reply
    await db.execute(sql`
      insert into chats (id, user_id, role, content)
      values (
        ${randomUUID()},
        ${user.id},
        'assistant',
        ${finalText}
      )
    `);

    reply.raw.write("event: done\ndata: end\n\n");
    reply.raw.end();

    await logUsage(user.id, "/chat/stream", 0);
  });
}

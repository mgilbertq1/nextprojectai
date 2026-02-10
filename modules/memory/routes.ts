import { FastifyInstance } from "fastify";
import { requireUser } from "../auth/hooks";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function memoryRoutes(app: FastifyInstance) {

  // ======================
  // GET all memories
  // ======================
  app.get("/memories", async (request) => {
    const user = await requireUser(request);

    const rows = await db.execute<{
      id: string;
      content: string;
    }>(sql`
      select id, content
      from memories
      where user_id = ${user.id}
      order by updated_at desc
    `);

    return { memories: rows };
  });

  // ======================
  // ADD memory
  // ======================
  app.post("/memories", async (request) => {
    const user = await requireUser(request);
    const { content } = request.body as { content: string };

    if (!content || content.length < 3) {
      throw app.httpErrors.badRequest("Invalid memory");
    }

    await db.execute(sql`
      insert into memories (id, user_id, content)
      values (
        ${randomUUID()},
        ${user.id},
        ${content}
      )
    `);

    return { status: "saved" };
  });

  // ======================
  // UPDATE memory
  // ======================
  app.put("/memories/:id", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };

    await db.execute(sql`
      update memories
      set content = ${content}, updated_at = now()
      where id = ${id}
        and user_id = ${user.id}
    `);

    return { status: "updated" };
  });

  // ======================
  // DELETE memory
  // ======================
  app.delete("/memories/:id", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };

    await db.execute(sql`
      delete from memories
      where id = ${id}
        and user_id = ${user.id}
    `);

    return { status: "deleted" };
  });
}

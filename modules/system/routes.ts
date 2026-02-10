import { FastifyInstance } from "fastify";
import { requireAdmin } from "../auth/hooks";
import { db } from "../../db/drizzle";
import { sql } from "drizzle-orm";


export async function systemRoutes(app: FastifyInstance) {

  app.post("/admin/system/flags/:key", async (request) => {
    await requireAdmin(request);

    const { key } = request.params as { key: string };
    const { value } = request.body as { value: string };

    await db.execute(sql`
      insert into system_flags (key, value)
      values (${key}, ${value})
      on conflict (key)
      do update set value = excluded.value
    `);

    return {
      key,
      value,
    };
  });
}

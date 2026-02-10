import { FastifyInstance } from "fastify";
import { requireUser } from "../auth/hooks";
import { requireNotMaintenance } from "../system/guards";

export async function userRoutes(app: FastifyInstance) {
  app.get("/users/me", async (request) => {
      await requireNotMaintenance(request);
    const user = await requireUser(request);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      banned: user.banned,
    };
  });
}

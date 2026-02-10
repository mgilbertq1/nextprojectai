import { FastifyRequest } from "fastify";
import { getSystemFlag } from "./flags";

export async function requireNotMaintenance(
  request: FastifyRequest
) {
  const flag = await getSystemFlag("maintenance_mode");

  if (flag === "on") {
    throw request.server.httpErrors.serviceUnavailable(
      "System under maintenance"
    );
  }
}

export async function requireChatEnabled(
  request: FastifyRequest
) {
  const flag = await getSystemFlag("chat_kill_switch");

  if (flag === "on") {
    throw request.server.httpErrors.forbidden(
      "Chat temporarily disabled"
    );
  }
}

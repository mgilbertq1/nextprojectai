import Fastify from "fastify";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import formbody from "@fastify/formbody";
import rawBody from "fastify-raw-body";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import { authRoutes } from "./modules/auth/routes";
import { userRoutes } from "./modules/users/routes";
import { adminRoutes } from "./modules/admin/routes";
import { systemRoutes } from "./modules/system/routes";
import { chatRoutes } from "./modules/chat/routes";
import { memoryRoutes } from "./modules/memory/routes";
import { userManagementRoutes } from "./modules/admin/users";
import { supportRoutes } from "./modules/support/routes";
import { settingsRoutes } from "./modules/settings/routes";
import { adminSettingsRoutes } from "./modules/admin/adminSettings";

export function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 10485760,
    exposeHeadRoutes: false,
  });

  app.register(cors, {
    origin: ["http://localhost:3000", "https://lyraaifrontend.vercel.app"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  });

  app.register(cookie);
  app.register(sensible);

  // ── multipart HARUS sebelum formbody & addContentTypeParser ──────────────
  // Kalau terbalik, JSON routes bisa conflict dengan multipart parser
  app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB
      files: 5,                    // max 5 file per request
    },
  });

  app.register(formbody);
  app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    function (req, body, done) {
      try {
        const json = JSON.parse(body as string);
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // ── Routes ────────────────────────────────────────────────────────────────
  app.register(authRoutes);
  app.register(userRoutes);
  app.register(adminRoutes, { prefix: "/admin" });
  app.register(userManagementRoutes);
  app.register(systemRoutes);
  app.register(supportRoutes);
  app.register(chatRoutes);
  app.register(settingsRoutes);
  app.register(memoryRoutes);
  app.register(adminSettingsRoutes);

  return app;
}
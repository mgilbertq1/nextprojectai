import { FastifyInstance } from "fastify";
import { requireAdmin } from "../auth/hooks";

import {
  getMessageTrend,
  getTokenTrend,
  getAnalyticsOverview,
  getEngagementTrend,
  getAnalyticsUsers,
  getModelUsageStats,
} from "./analytics";
import { getSystemFlags, updateSystemFlag } from "./system";
import { parseDateRange } from "./utils";
import { getDashboardOverview } from "./dashboard";
import { getUsersMonthlyGrowth } from "./dashboardGrowth";
import { getActiveUsers } from "./dashboardActive";
import { getLoginActivity, deleteLoginLog } from "./loginActivity";
import { getTokenizerOverview, getTokenUsageHistory, getRecentTokenizations } from "./tokenizer";
import { getAllModels, createModel, updateModel, deleteModel } from "./aiModels";
import { getSystemPrompt, updateSystemPrompt } from "../ai/systemPrompt";

export async function adminRoutes(app: FastifyInstance) {

  // =========================
  // ANALYTICS
  // =========================
  app.get("/analytics/messages", async (req) => {
    await requireAdmin(req);
    const { from, to } = parseDateRange(req);
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    return getMessageTrend(from ?? thirtyDaysAgo, to ?? now);
  });

  app.get("/analytics/tokens", async (req) => {
    await requireAdmin(req);
    const { from, to } = parseDateRange(req);
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    return getTokenTrend(from ?? thirtyDaysAgo, to ?? now);
  });

  app.get("/analytics/overview", async (req) => {
    await requireAdmin(req);
    return getAnalyticsOverview();
  });

  app.get("/analytics/model-usage", async (req) => {
  await requireAdmin(req);
  return getModelUsageStats();
});

  app.get("/analytics/engagement-trend", async (req) => {
    await requireAdmin(req);
    return getEngagementTrend();
  });

  app.get("/analytics/users", async (req) => {
    await requireAdmin(req);
    const {
      page = "1",
      limit = "10",
      search = "",
      status = "all",
    } = req.query as Record<string, string>;
    return getAnalyticsUsers(Number(page), Number(limit), search, status);
  });

  // =========================
  // DASHBOARD
  // =========================
  app.get("/dashboard/overview", async (req) => {
    await requireAdmin(req);
    return getDashboardOverview();
  });

  app.get("/dashboard/users-growth", async (req) => {
    await requireAdmin(req);
    return getUsersMonthlyGrowth();
  });

  app.get("/dashboard/active-users", async (req) => {
    await requireAdmin(req);
    const { range = "24h" } = req.query as { range?: string };
    return getActiveUsers(range);
  });

  // =========================
  // LOGIN ACTIVITY
  // =========================
  app.get("/login-activity", async (req) => {
    await requireAdmin(req);
    const { page = "1", limit = "10" } = req.query as {
      page?: string;
      limit?: string;
    };
    return getLoginActivity(Number(page), Number(limit));
  });

  app.delete("/login-activity/:id", async (req) => {
    await requireAdmin(req);
    const { id } = req.params as { id: string };
    await deleteLoginLog(id);
    return { status: "deleted" };
  });

  // =========================
  // AI MODELS
  // =========================
  app.get("/models", async (req) => {
    await requireAdmin(req);
    return getAllModels();
  });

  app.post("/models", async (req) => {
    await requireAdmin(req);
    const body = req.body as any;
    return createModel(body);
  });

  app.patch("/models/:id", async (req) => {
    await requireAdmin(req);
    const { id } = req.params as { id: string };
    const body = req.body as any;
    await updateModel(id, body);
    return { status: "updated" };
  });

  app.delete("/models/:id", async (req) => {
    await requireAdmin(req);
    const { id } = req.params as { id: string };
    await deleteModel(id);
    return { status: "deleted" };
  });

  // =========================
  // TOKENIZER
  // =========================
  app.get("/tokenizer/overview", async (req) => {
    await requireAdmin(req);
    return getTokenizerOverview();
  });

  app.get("/tokenizer/history", async (req) => {
    await requireAdmin(req);
    return getTokenUsageHistory();
  });

  app.get("/tokenizer/recent", async (req) => {
    await requireAdmin(req);
    const { limit = "5" } = req.query as { limit?: string };
    return getRecentTokenizations(Number(limit));
  });

  // =========================
  // SYSTEM CONTROL
  // =========================
  app.get("/system", async (req) => {
    await requireAdmin(req);
    return getSystemFlags();
  });

  app.patch("/system", async (req) => {
    await requireAdmin(req);
    const { key, value } = req.body as { key: string; value: any };
    if (!key) throw req.server.httpErrors.badRequest("Key required");
    return updateSystemFlag(key, value);
  });

  // =========================
  // SYSTEM PROMPT
  // =========================
  app.get("/system/prompt", async (req) => {
    await requireAdmin(req);
    const content = await getSystemPrompt();
    return { content };
  });
 
  app.post("/system/prompt", async (req) => {
    await requireAdmin(req);
    const { content } = req.body as { content: string };
    if (!content?.trim()) throw app.httpErrors.badRequest("Content required");
    await updateSystemPrompt(content);
    return { status: "updated" };
  });
}
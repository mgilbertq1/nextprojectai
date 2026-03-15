import { FastifyInstance } from "fastify";
import { requireAdmin } from "../auth/hooks";

import { getMessageTrend, getTokenTrend } from "./analytics";
import { getSystemFlags, updateSystemFlag } from "./system";
import { parseDateRange } from "./utils";
import { getDashboardOverview } from "./dashboard";
import { getUsersMonthlyGrowth } from "./dashboardGrowth";
import { getActiveUsers } from "./dashboardActive";
import { getLoginActivity, deleteLoginLog } from "./loginActivity";

export async function adminRoutes(app: FastifyInstance) {

  // =========================
  // ANALYTICS
  // =========================
  app.get("/analytics/messages", async (req) => {
    await requireAdmin(req)

    const { from, to } = parseDateRange(req)

    return getMessageTrend(from, to)
  })

  app.get("/analytics/tokens", async (req) => {
    await requireAdmin(req)

    const { from, to } = parseDateRange(req)

    return getTokenTrend(from, to)
  })

  // =========================
  // DASHBOARD
  // =========================
  app.get("/dashboard/overview", async (req) => {
    await requireAdmin(req)

    return getDashboardOverview()
  })

  app.get("/dashboard/users-growth", async (req) => {
    await requireAdmin(req)

    return getUsersMonthlyGrowth()
  })

  app.get("/dashboard/active-users", async (req) => {
    await requireAdmin(req)

    const { range = "24h" } = req.query as {
      range?: string
    }

    return getActiveUsers(range)
  })

  // =========================
  // LOGIN ACTIVITY
  // =========================
  app.get("/login-activity", async (req) => {
    await requireAdmin(req)

    const { page = "1", limit = "10" } = req.query as {
      page?: string
      limit?: string
    }

    return getLoginActivity(Number(page), Number(limit))
  })

  app.delete("/login-activity/:id", async (req) => {
    await requireAdmin(req)

    const { id } = req.params as { id: string }

    await deleteLoginLog(id)

    return { status: "deleted" }
  })

  // =========================
  // SYSTEM CONTROL
  // =========================
  app.get("/system", async (req) => {
    await requireAdmin(req)

    return getSystemFlags()
  })

  app.patch("/system", async (req) => {
    await requireAdmin(req)

    const { key, value } = req.body as {
      key: string
      value: any
    }

    if (!key) {
      throw req.server.httpErrors.badRequest("Key required")
    }

    return updateSystemFlag(key, value)
  })
}
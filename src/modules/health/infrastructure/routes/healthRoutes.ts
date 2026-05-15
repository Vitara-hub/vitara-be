import type { SupabaseClient } from "@supabase/supabase-js";
import { Router } from "express";
import { authMiddleware } from "../../../../infrastructure/http/middleware/authMiddleware.js";
import type { HealthController } from "../controllers/HealthController.js";

export function healthRoutes(
  controller: HealthController,
  supabaseAdmin: SupabaseClient,
): Router {
  const router = Router();
  const auth = authMiddleware(supabaseAdmin);

  router.post("/health/compute", auth, controller.compute);
  router.get("/health/daily", auth, controller.daily);

  router.get("/dashboard/today", auth, controller.dashboardToday);

  router.get("/activity/summary", auth, controller.activitySummary);
  router.get("/activity/recent", auth, controller.activityRecent);

  return router;
}

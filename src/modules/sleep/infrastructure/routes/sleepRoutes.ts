import type { SupabaseClient } from "@supabase/supabase-js";
import { Router } from "express";
import { authMiddleware } from "../../../../infrastructure/http/middleware/authMiddleware.js";
import type { SleepController } from "../controllers/SleepController.js";

export function sleepRoutes(
  controller: SleepController,
  supabaseAdmin: SupabaseClient,
): Router {
  const router = Router();
  const auth = authMiddleware(supabaseAdmin);

  router.post("/analyze", auth, controller.analyze);
  router.get("/", auth, controller.list);

  return router;
}

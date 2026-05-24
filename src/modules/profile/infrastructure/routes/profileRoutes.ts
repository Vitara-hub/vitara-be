import type { SupabaseClient } from "@supabase/supabase-js";
import { Router } from "express";
import { authMiddleware } from "../../../../infrastructure/http/middleware/authMiddleware.js";
import type { ProfileController } from "../controllers/ProfileController.js";

export function profileRoutes(
  controller: ProfileController,
  supabaseAdmin: SupabaseClient,
): Router {
  const router = Router();
  const auth = authMiddleware(supabaseAdmin);

  router.get("/", auth, controller.get);
  router.post("/bootstrap", auth, controller.bootstrap);
  router.patch("/", auth, controller.update);
  router.post("/request-delete", auth, controller.requestDelete);

  return router;
}

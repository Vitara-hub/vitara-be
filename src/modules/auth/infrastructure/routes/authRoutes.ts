import type { SupabaseClient } from "@supabase/supabase-js";
import { Router } from "express";
import { authMiddleware } from "../../../../infrastructure/http/middleware/authMiddleware.js";
import type { AuthController } from "../controllers/AuthController.js";

export function authRoutes(
  controller: AuthController,
  supabaseAdmin: SupabaseClient,
): Router {
  const router = Router();
  const auth = authMiddleware(supabaseAdmin);

  router.post("/signup", controller.signup);
  router.post("/login", controller.login);
  router.post("/google", controller.google);
  router.post("/google/callback", controller.googleCallback);
  router.post("/refresh", controller.refresh);
  router.post("/logout", auth, controller.logout);
  router.get("/me", auth, controller.me);

  return router;
}

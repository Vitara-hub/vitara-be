import { Router } from "express";
import type { TypingController } from "../controllers/TypingController.js";
import { authMiddleware } from "../../../../infrastructure/http/middleware/authMiddleware.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export function typingRoutes(controller: TypingController, supabaseAdmin: SupabaseClient): Router {
  const router = Router();
  const auth = authMiddleware(supabaseAdmin);

  router.post("/", auth, controller.create);
  router.get("/", auth, controller.list);

  return router;
}

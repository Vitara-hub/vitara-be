import { Router } from "express";
import type { ChatController } from "../controllers/ChatController.js";
import { authMiddleware } from "../../../../infrastructure/http/middleware/authMiddleware.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export function chatRoutes(controller: ChatController, supabaseAdmin: SupabaseClient): Router {
  const router = Router();
  const auth = authMiddleware(supabaseAdmin);

  router.post("/", auth, controller.send);
  router.get("/:sessionId", auth, controller.history);

  return router;
}

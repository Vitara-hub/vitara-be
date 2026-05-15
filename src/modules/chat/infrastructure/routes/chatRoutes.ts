import type { SupabaseClient } from "@supabase/supabase-js";
import { Router } from "express";
import { authMiddleware } from "../../../../infrastructure/http/middleware/authMiddleware.js";
import type { ChatController } from "../controllers/ChatController.js";

export function chatRoutes(
  controller: ChatController,
  supabaseAdmin: SupabaseClient,
): Router {
  const router = Router();
  const auth = authMiddleware(supabaseAdmin);

  router.post("/sessions", auth, controller.createSession);
  router.get("/sessions", auth, controller.listSessions);
  router.post("/messages", auth, controller.sendMessage);
  router.get("/messages", auth, controller.listMessages);

  return router;
}

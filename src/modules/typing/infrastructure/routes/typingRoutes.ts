import type { SupabaseClient } from "@supabase/supabase-js";
import { Router } from "express";
import { authMiddleware } from "../../../../infrastructure/http/middleware/authMiddleware.js";
import type { TypingController } from "../controllers/TypingController.js";

export function typingRoutes(
  controller: TypingController,
  supabaseAdmin: SupabaseClient,
): Router {
  const router = Router();
  const auth = authMiddleware(supabaseAdmin);

  // Typing endpoints
  router.post("/typing/analyze", auth, controller.analyze);
  router.get("/typing", auth, controller.list);

  // Journal endpoints (implemented inside typing module as requested)
  router.post("/journal/analyze", auth, controller.analyzeJournal);
  router.get("/journal", auth, controller.listJournal);

  return router;
}

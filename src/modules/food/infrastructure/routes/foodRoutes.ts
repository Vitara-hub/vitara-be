import { Router } from "express";
import type { FoodController } from "../controllers/FoodController.js";
import { authMiddleware } from "../../../../infrastructure/http/middleware/authMiddleware.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export function foodRoutes(controller: FoodController, supabaseAdmin: SupabaseClient): Router {
  const router = Router();
  const auth = authMiddleware(supabaseAdmin);

  router.post("/", auth, controller.create);
  router.get("/", auth, controller.list);

  return router;
}

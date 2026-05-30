import type { SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../config/env.js";
import { getSupabaseAdmin } from "../database/SupabaseClient.js";
import { AiGatewayClient } from "../ai/AiGatewayClient.js";

import { AuthController } from "../../modules/auth/infrastructure/controllers/AuthController.js";
import { ProfileController } from "../../modules/profile/infrastructure/controllers/ProfileController.js";
import { FoodController } from "../../modules/food/infrastructure/controllers/FoodController.js";
import { SleepController } from "../../modules/sleep/infrastructure/controllers/SleepController.js";
import { TypingController } from "../../modules/typing/infrastructure/controllers/TypingController.js";
import { ChatController } from "../../modules/chat/infrastructure/controllers/ChatController.js";
import { HealthSnapshotService } from "../../modules/health/application/services/HealthSnapshotService.js";
import { HealthController } from "../../modules/health/infrastructure/controllers/HealthController.js";

export interface Container {
  env: Env;
  supabaseAdmin: SupabaseClient;

  authController: AuthController;
  profileController: ProfileController;
  foodController: FoodController;
  sleepController: SleepController;
  typingController: TypingController;
  chatController: ChatController;
  healthController: HealthController;
}

export function createContainer(env: Env): Container {
  const supabaseAdmin = getSupabaseAdmin(env);
  const aiGatewayClient = new AiGatewayClient(env);

  const authController = new AuthController(env, supabaseAdmin);
  const profileController = new ProfileController(supabaseAdmin);
  const foodController = new FoodController(
    env,
    supabaseAdmin,
    aiGatewayClient,
  );
  const sleepController = new SleepController(supabaseAdmin, aiGatewayClient);
  const typingController = new TypingController(supabaseAdmin, aiGatewayClient);
  const chatController = new ChatController(supabaseAdmin, aiGatewayClient);

  const healthSnapshotService = new HealthSnapshotService(
    supabaseAdmin,
    aiGatewayClient,
  );
  const healthController = new HealthController(
    supabaseAdmin,
    healthSnapshotService,
  );

  return {
    env,
    supabaseAdmin,
    authController,
    profileController,
    foodController,
    sleepController,
    typingController,
    chatController,
    healthController,
  };
}

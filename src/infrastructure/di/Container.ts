import type { SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../config/env.js";
import { getSupabaseAdmin } from "../database/SupabaseClient.js";

// ── Repository imports ────────────────────────────────
import { SupabaseFoodRepository } from "../../modules/food/infrastructure/repositories/SupabaseFoodRepository.js";
import { SupabaseSleepRepository } from "../../modules/sleep/infrastructure/repositories/SupabaseSleepRepository.js";
import { SupabaseTypingRepository } from "../../modules/typing/infrastructure/repositories/SupabaseTypingRepository.js";
import { SupabaseChatRepository } from "../../modules/chat/infrastructure/repositories/SupabaseChatRepository.js";

// ── Use-case imports ──────────────────────────────────
import { CreateFoodEntry } from "../../modules/food/application/use-cases/CreateFoodEntry.js";
import { GetFoodEntries } from "../../modules/food/application/use-cases/GetFoodEntries.js";
import { CreateSleepEntry } from "../../modules/sleep/application/use-cases/CreateSleepEntry.js";
import { GetSleepEntries } from "../../modules/sleep/application/use-cases/GetSleepEntries.js";
import { CreateTypingSession } from "../../modules/typing/application/use-cases/CreateTypingSession.js";
import { GetTypingSessions } from "../../modules/typing/application/use-cases/GetTypingSessions.js";
import { SendMessage } from "../../modules/chat/application/use-cases/SendMessage.js";
import { GetChatHistory } from "../../modules/chat/application/use-cases/GetChatHistory.js";

// ── Controller imports ────────────────────────────────
import { FoodController } from "../../modules/food/infrastructure/controllers/FoodController.js";
import { SleepController } from "../../modules/sleep/infrastructure/controllers/SleepController.js";
import { TypingController } from "../../modules/typing/infrastructure/controllers/TypingController.js";
import { ChatController } from "../../modules/chat/infrastructure/controllers/ChatController.js";

export interface Container {
  env: Env;
  supabaseAdmin: SupabaseClient;

  // Controllers (public surface used by routes)
  foodController: FoodController;
  sleepController: SleepController;
  typingController: TypingController;
  chatController: ChatController;
}

export function createContainer(env: Env): Container {
  const supabaseAdmin = getSupabaseAdmin(env);

  // ── Repositories ──────────────────────────────────
  const foodRepo = new SupabaseFoodRepository(supabaseAdmin);
  const sleepRepo = new SupabaseSleepRepository(supabaseAdmin);
  const typingRepo = new SupabaseTypingRepository(supabaseAdmin);
  const chatRepo = new SupabaseChatRepository(supabaseAdmin);

  // ── Use cases ─────────────────────────────────────
  const createFoodEntry = new CreateFoodEntry(foodRepo);
  const getFoodEntries = new GetFoodEntries(foodRepo);

  const createSleepEntry = new CreateSleepEntry(sleepRepo);
  const getSleepEntries = new GetSleepEntries(sleepRepo);

  const createTypingSession = new CreateTypingSession(typingRepo);
  const getTypingSessions = new GetTypingSessions(typingRepo);

  const sendMessage = new SendMessage(chatRepo);
  const getChatHistory = new GetChatHistory(chatRepo);

  // ── Controllers ───────────────────────────────────
  const foodController = new FoodController(createFoodEntry, getFoodEntries);
  const sleepController = new SleepController(
    createSleepEntry,
    getSleepEntries,
  );
  const typingController = new TypingController(
    createTypingSession,
    getTypingSessions,
  );
  const chatController = new ChatController(sendMessage, getChatHistory);

  return {
    env,
    supabaseAdmin,
    foodController,
    sleepController,
    typingController,
    chatController,
  };
}

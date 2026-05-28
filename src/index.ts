import { Logger } from "./core/logger/Logger.js";
import { loadEnv } from "./infrastructure/config/env.js";
import { createContainer } from "./infrastructure/di/Container.js";
import {
  applyErrorHandler,
  createExpressApp,
} from "./infrastructure/http/ExpressApp.js";
import { authRoutes } from "./modules/auth/infrastructure/routes/authRoutes.js";
import { chatRoutes } from "./modules/chat/infrastructure/routes/chatRoutes.js";
import { foodRoutes } from "./modules/food/infrastructure/routes/foodRoutes.js";
import { healthRoutes } from "./modules/health/infrastructure/routes/healthRoutes.js";
import { profileRoutes } from "./modules/profile/infrastructure/routes/profileRoutes.js";
import { sleepRoutes } from "./modules/sleep/infrastructure/routes/sleepRoutes.js";
import { typingRoutes } from "./modules/typing/infrastructure/routes/typingRoutes.js";

const logger = new Logger("Main");

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const container = createContainer(env);

  const app = createExpressApp();

  app.use(
    "/api/auth",
    authRoutes(container.authController, container.supabaseAdmin),
  );
  app.use(
    "/api/profile",
    profileRoutes(container.profileController, container.supabaseAdmin),
  );
  app.use(
    "/api/food",
    foodRoutes(container.foodController, container.supabaseAdmin),
  );
  app.use(
    "/api/sleep",
    sleepRoutes(container.sleepController, container.supabaseAdmin),
  );
  app.use(
    "/api/chat",
    chatRoutes(container.chatController, container.supabaseAdmin),
  );
  app.use(
    "/api",
    typingRoutes(container.typingController, container.supabaseAdmin),
  );
  app.use(
    "/api",
    healthRoutes(container.healthController, container.supabaseAdmin),
  );

  applyErrorHandler(app);

  app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server", err);
  process.exit(1);
});

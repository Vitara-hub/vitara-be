import { loadEnv } from "./infrastructure/config/env.js";
import {
  createExpressApp,
  applyErrorHandler,
} from "./infrastructure/http/ExpressApp.js";
import { createContainer } from "./infrastructure/di/Container.js";
import { foodRoutes } from "./modules/food/infrastructure/routes/foodRoutes.js";
import { sleepRoutes } from "./modules/sleep/infrastructure/routes/sleepRoutes.js";
import { typingRoutes } from "./modules/typing/infrastructure/routes/typingRoutes.js";
import { chatRoutes } from "./modules/chat/infrastructure/routes/chatRoutes.js";
import { Logger } from "./core/logger/Logger.js";

const logger = new Logger("Main");

async function bootstrap(): Promise<void> {
  // 1. Load & validate env
  const env = loadEnv();

  // 2. Build DI container (repos → use-cases → controllers)
  const container = createContainer(env);

  // 3. Create Express app with global middleware
  const app = createExpressApp();

  // 4. Register module routes
  app.use(
    "/api/food",
    foodRoutes(container.foodController, container.supabaseAdmin),
  );
  app.use(
    "/api/sleep",
    sleepRoutes(container.sleepController, container.supabaseAdmin),
  );
  app.use(
    "/api/typing",
    typingRoutes(container.typingController, container.supabaseAdmin),
  );
  app.use(
    "/api/chat",
    chatRoutes(container.chatController, container.supabaseAdmin),
  );

  // 5. Error handler must be registered last
  applyErrorHandler(app);

  // 6. Start server
  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server", err);
  process.exit(1);
});

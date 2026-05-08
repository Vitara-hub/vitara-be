import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { openApiDocument } from "./swagger/openapi.js";

export function createExpressApp(): Express {
  const app = express();

  // ── Global middleware ───────────────────────────────
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // ── API documentation ──────────────────────────────
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  // ── Health check ────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

/**
 * Must be called AFTER all routes are registered so Express
 * treats it as an error-handling middleware (4 params).
 */
export function applyErrorHandler(app: Express): void {
  app.use(errorHandler);
}

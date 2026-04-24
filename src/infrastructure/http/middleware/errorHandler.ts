import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../core/errors/AppError.js";
import { Logger } from "../../../core/logger/Logger.js";

const logger = new Logger("ErrorHandler");

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn(err.message, { statusCode: err.statusCode });
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    });
    return;
  }

  logger.error("Unhandled error", { message: err.message, stack: err.stack });
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
}

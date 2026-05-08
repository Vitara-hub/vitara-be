import type { Request, Response, NextFunction } from "express";
import { Logger } from "../../../core/logger/Logger.js";

const logger = new Logger("HTTP");

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });

  next();
}

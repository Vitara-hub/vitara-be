import type { Request } from "express";
import type { ZodError } from "zod";
import { UnauthorizedError } from "../../../../core/errors/AppError.js";

export function requireUserId(req: Request): string {
  if (!req.userId) {
    throw new UnauthorizedError("Unauthorized");
  }

  return req.userId;
}

export function parseValidationError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export function extractBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }

  return header.slice(7);
}

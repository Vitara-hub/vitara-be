import type { Request, Response, NextFunction } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UnauthorizedError } from "../../../core/errors/AppError.js";

/**
 * Extend Express Request to carry the authenticated user id and Supabase client.
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      supabase?: SupabaseClient;
    }
  }
}

export function authMiddleware(supabaseAdmin: SupabaseClient) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        throw new UnauthorizedError("Missing or malformed Authorization header");
      }

      const token = header.slice(7);
      const { data, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !data.user) {
        throw new UnauthorizedError("Invalid or expired token");
      }

      req.userId = data.user.id;
      next();
    } catch (err) {
      next(err);
    }
  };
}

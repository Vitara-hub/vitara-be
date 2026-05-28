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
      let token: string | undefined;
      const header = req.headers.authorization;
      if (header?.startsWith("Bearer ")) {
        token = header.slice(7);
      } else if (req.cookies && req.cookies.access_token) {
        token = req.cookies.access_token;
      }

      if (!token) {
        throw new UnauthorizedError("Missing or malformed Authorization token");
      }

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

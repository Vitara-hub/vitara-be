import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../../../core/errors/AppError.js";
import { parseValidationError, requireUserId } from "../../../shared/infrastructure/utils/requestUtils.js";
import { requestDeleteSchema, updateProfileSchema } from "../validation/profileSchemas.js";

export class ProfileController {
  constructor(private readonly supabase: SupabaseClient) {}

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = requireUserId(req);

      const { data, error } = await this.supabase
        .from("profiles")
        .select("id, username, email, full_name, timezone")
        .eq("id", userId)
        .single();

      if (error || !data) {
        throw new NotFoundError("Profile");
      }

      res.json({
        status: "success",
        data: {
          id: String(data.id),
          username: typeof data.username === "string" ? data.username : null,
          email: typeof data.email === "string" ? data.email : null,
          fullName: typeof data.full_name === "string" ? data.full_name : null,
          timezone: typeof data.timezone === "string" ? data.timezone : "Asia/Jakarta",
        },
      });
    } catch (err) {
      next(err);
    }
  };

  bootstrap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = requireUserId(req);

      const { data: authData, error: authError } = await this.supabase.auth.admin.getUserById(
        userId,
      );

      if (authError || !authData.user) {
        throw new AppError(`Unable to read auth user: ${authError?.message ?? "unknown"}`, 500);
      }

      const metadata = (authData.user.user_metadata ?? {}) as Record<string, unknown>;
      const username =
        typeof metadata.username === "string" && metadata.username.length > 0
          ? metadata.username
          : null;
      const fullName =
        typeof metadata.full_name === "string"
          ? metadata.full_name
          : typeof metadata.name === "string"
            ? metadata.name
            : null;

      const { data, error } = await this.supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            username,
            email: authData.user.email ?? null,
            full_name: fullName,
          },
          {
            onConflict: "id",
          },
        )
        .select("id, username, email, full_name, timezone")
        .single();

      if (error || !data) {
        throw new AppError(`Failed to bootstrap profile: ${error?.message ?? "unknown"}`, 500);
      }

      res.json({
        status: "success",
        data: {
          id: String(data.id),
          username: typeof data.username === "string" ? data.username : null,
          email: typeof data.email === "string" ? data.email : null,
          fullName: typeof data.full_name === "string" ? data.full_name : null,
          timezone: typeof data.timezone === "string" ? data.timezone : "Asia/Jakarta",
        },
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = updateProfileSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.username !== undefined) updates.username = parsed.data.username;
      if (parsed.data.fullName !== undefined) updates.full_name = parsed.data.fullName;
      if (parsed.data.timezone !== undefined) updates.timezone = parsed.data.timezone;

      const { data, error } = await this.supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId)
        .select("id, username, email, full_name, timezone")
        .single();

      if (error || !data) {
        const message = (error?.message ?? "unknown").toLowerCase();
        if (message.includes("duplicate") || message.includes("unique")) {
          throw new ConflictError("Username or email already in use");
        }

        throw new AppError(`Failed to update profile: ${error?.message ?? "unknown"}`, 500);
      }

      res.json({
        status: "success",
        data: {
          id: String(data.id),
          username: typeof data.username === "string" ? data.username : null,
          email: typeof data.email === "string" ? data.email : null,
          fullName: typeof data.full_name === "string" ? data.full_name : null,
          timezone: typeof data.timezone === "string" ? data.timezone : "Asia/Jakarta",
        },
      });
    } catch (err) {
      next(err);
    }
  };

  requestDelete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = requestDeleteSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const { data, error } = await this.supabase
        .from("request_delete_user_data")
        .insert({
          user_id: userId,
        })
        .select("id, requested_at, processed")
        .single();

      if (error || !data) {
        throw new AppError(`Failed to request deletion: ${error?.message ?? "unknown"}`, 500);
      }

      res.status(201).json({
        status: "success",
        data: {
          requestId: String(data.id),
          requestedAt: String(data.requested_at),
          processed: Boolean(data.processed),
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

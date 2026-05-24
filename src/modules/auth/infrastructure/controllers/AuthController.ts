import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import {
  AppError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
} from "../../../../core/errors/AppError.js";
import type { Env } from "../../../../infrastructure/config/env.js";
import {
  extractBearerToken,
  parseValidationError,
  requireUserId,
} from "../../../shared/infrastructure/utils/requestUtils.js";
import {
  googleCallbackSchema,
  loginSchema,
  refreshSchema,
  signupSchema,
} from "../validation/authSchemas.js";

export class AuthController {
  constructor(
    private readonly env: Env,
    private readonly supabase: SupabaseClient,
  ) {}

  private sessionPayload(session: {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  }) {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in ?? 3600,
    };
  }

  private buildAnonClient(accessToken?: string): SupabaseClient {
    const headers = accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined;

    return createClient(this.env.SUPABASE_URL, this.env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: headers ? { headers } : undefined,
    });
  }

  signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const { username, fullName, email, password } = parsed.data;

      const { data, error } = await this.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          full_name: fullName,
        },
      });

      if (error || !data.user) {
        const message = error?.message ?? "Failed to create user";
        if (message.toLowerCase().includes("already")) {
          throw new ConflictError("Email already registered");
        }

        throw new AppError(message, 400);
      }

      const { error: profileError } = await this.supabase.from("profiles").upsert(
        {
          id: data.user.id,
          username,
          email,
          full_name: fullName,
        },
        {
          onConflict: "id",
        },
      );

      if (profileError) {
        throw new AppError(`Failed to bootstrap profile: ${profileError.message}`, 500);
      }

      res.status(201).json({
        status: "success",
        data: {
          userId: data.user.id,
          email,
          username,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const anon = this.buildAnonClient();
      const { data, error } = await anon.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error || !data.session) {
        throw new UnauthorizedError("Invalid email or password");
      }

      res.json({
        status: "success",
        data: this.sessionPayload(data.session),
      });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = refreshSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const anon = this.buildAnonClient();
      const { data, error } = await anon.auth.refreshSession({
        refresh_token: parsed.data.refreshToken,
      });

      if (error || !data.session) {
        throw new UnauthorizedError("Invalid or expired refresh token");
      }

      res.json({
        status: "success",
        data: this.sessionPayload(data.session),
      });
    } catch (err) {
      next(err);
    }
  };

  googleCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = googleCallbackSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const anon = this.buildAnonClient();

      if ("code" in parsed.data) {
        const { data, error } = await anon.auth.exchangeCodeForSession(parsed.data.code);

        if (error || !data.session) {
          throw new UnauthorizedError(error?.message ?? "Failed to complete Google sign-in");
        }

        res.json({
          status: "success",
          data: this.sessionPayload(data.session),
        });
        return;
      }

      const tokenClient = this.buildAnonClient(parsed.data.accessToken);
      const { data: userData, error: userError } = await tokenClient.auth.getUser();

      if (userError || !userData.user) {
        throw new UnauthorizedError("Invalid OAuth session tokens");
      }

      res.json({
        status: "success",
        data: {
          accessToken: parsed.data.accessToken,
          refreshToken: parsed.data.refreshToken,
          expiresIn: 3600,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  google = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const anon = this.buildAnonClient();
      const redirectTo =
        this.env.GOOGLE_OAUTH_REDIRECT_URL && this.env.GOOGLE_OAUTH_REDIRECT_URL.length > 0
          ? this.env.GOOGLE_OAUTH_REDIRECT_URL
          : undefined;

      const { data, error } = await anon.auth.signInWithOAuth({
        provider: "google",
        options: redirectTo ? { redirectTo } : undefined,
      });

      if (error || !data.url) {
        throw new AppError(error?.message ?? "Failed to generate auth URL", 500);
      }

      res.json({
        status: "success",
        data: {
          authUrl: data.url,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      requireUserId(req);
      const token = extractBearerToken(req);
      const anon = this.buildAnonClient(token);
      const { error } = await anon.auth.signOut();

      if (error) {
        throw new AppError(`Logout failed: ${error.message}`, 400);
      }

      res.json({
        status: "success",
        data: {},
      });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
}

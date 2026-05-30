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
  parseValidationError,
  requireUserId,
} from "../../../shared/infrastructure/utils/requestUtils.js";
import {
  googleCallbackSchema,
  loginSchema,
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

  private setCookies(res: Response, session: { access_token: string; refresh_token: string; expires_in?: number }) {
    const isProd = process.env.NODE_ENV === "production";
    const baseOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    };

    res.cookie("access_token", session.access_token, {
      ...baseOptions,
      maxAge: (session.expires_in ?? 3600) * 1000,
    });

    res.cookie("refresh_token", session.refresh_token, {
      ...baseOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }

  private clearCookies(res: Response) {
    const isProd = process.env.NODE_ENV === "production";
    const baseOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    };
    
    res.clearCookie("access_token", baseOptions);
    res.clearCookie("refresh_token", baseOptions);
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

  private extractImageUrlFromAuthUser(user: {
    user_metadata?: Record<string, unknown> | null;
    identities?: Array<{ identity_data?: Record<string, unknown> | null }> | null;
  }): string | null {
    const metadata = user.user_metadata ?? {};
    const directCandidates = [
      metadata.avatar_url,
      metadata.picture,
      metadata.photoURL,
    ];

    for (const candidate of directCandidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate;
      }
    }

    const identities = Array.isArray(user.identities) ? user.identities : [];
    for (const identity of identities) {
      const identityData = identity.identity_data ?? {};
      const fromIdentity = identityData.avatar_url;
      if (typeof fromIdentity === "string" && fromIdentity.trim().length > 0) {
        return fromIdentity;
      }
    }

    return null;
  }

  signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const { email, password } = parsed.data;
      const fullName = parsed.data.fullName || email.split("@")[0];
      
      let username = parsed.data.username;
      if (!username) {
        const localPart = email.split("@")[0];
        const normalized = localPart.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24);
        const safeBase = normalized.length >= 3 ? normalized : `${normalized}_user`;
        username = `${safeBase}_${Math.floor(Math.random() * 10000)}`.slice(0, 30);
      }

      // Check for unique username
      const { data: existingProfile, error: profileCheckError } = await this.supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      
      if (profileCheckError) {
         throw new AppError(`Failed to check username uniqueness: ${profileCheckError.message}`, 500);
      }
      
      if (existingProfile) {
        throw new ConflictError("Username is already taken");
      }

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

      this.setCookies(res, data.session);
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
      const refreshTokenFromCookie = req.cookies?.refresh_token;
      const bodyToken = req.body.refreshToken;
      
      const refreshToken = bodyToken || refreshTokenFromCookie;
      
      if (!refreshToken) {
         throw new BadRequestError("Missing refresh token");
      }

      const anon = this.buildAnonClient();
      const { data, error } = await anon.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        throw new UnauthorizedError("Invalid or expired refresh token");
      }

      this.setCookies(res, data.session);
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

        this.setCookies(res, data.session);
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

      // Accept implicit/hash tokens from client as a fallback, but still
      // move them into HttpOnly cookies for subsequent requests.
      this.setCookies(res, {
        access_token: parsed.data.accessToken,
        refresh_token: parsed.data.refreshToken,
        expires_in: 3600,
      });
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
      const header = req.headers.authorization;
      const token =
        header?.startsWith("Bearer ")
          ? header.slice(7)
          : (req.cookies?.access_token as string | undefined);

      if (!token) {
        // If the user is authenticated via cookies but token is missing, still clear cookies.
        this.clearCookies(res);
        res.json({ status: "success", data: {} });
        return;
      }
      const anon = this.buildAnonClient(token);
      const { error } = await anon.auth.signOut();

      if (error) {
        throw new AppError(`Logout failed: ${error.message}`, 400);
      }

      this.clearCookies(res);
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

      let imageUrl: string | null = null;
      const { data: authData, error: authError } =
        await this.supabase.auth.admin.getUserById(userId);

      if (!authError && authData.user) {
        imageUrl = this.extractImageUrlFromAuthUser(authData.user);
      }

      res.json({
        status: "success",
        data: {
          id: String(data.id),
          username: typeof data.username === "string" ? data.username : null,
          email: typeof data.email === "string" ? data.email : null,
          fullName: typeof data.full_name === "string" ? data.full_name : null,
          timezone: typeof data.timezone === "string" ? data.timezone : "Asia/Jakarta",
          imageUrl,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

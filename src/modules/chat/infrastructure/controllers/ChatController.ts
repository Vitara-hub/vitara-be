import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import {
  AppError,
  BadRequestError,
  NotFoundError,
} from "../../../../core/errors/AppError.js";
import {
  parseValidationError,
  requireUserId,
} from "../../../shared/infrastructure/utils/requestUtils.js";
import {
  chatMessagesQuerySchema,
  chatSessionsQuerySchema,
  createChatSessionSchema,
  sendChatMessageSchema,
} from "../validation/chatSchemas.js";

function createCompanionResponse(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("capek") || normalized.includes("lelah")) {
    return "Aku dengar kamu lagi capek. Coba ambil jeda 5 menit: tarik napas pelan 4 hitungan, tahan 4 hitungan, lalu hembuskan 6 hitungan. Setelah itu lanjut satu tugas kecil dulu ya.";
  }

  if (normalized.includes("cemas") || normalized.includes("anxious")) {
    return "Rasa cemas itu valid. Coba tulis 3 hal yang bisa kamu kontrol hari ini, lalu fokus ke yang paling kecil dulu. Kamu nggak harus menyelesaikan semuanya sekaligus.";
  }

  return "Terima kasih sudah cerita. Aku siap bantu kapan pun. Untuk langkah sekarang, coba minum air, atur napas selama 1 menit, lalu pilih satu aktivitas ringan yang paling mungkin kamu kerjakan.";
}

export class ChatController {
  constructor(private readonly supabase: SupabaseClient) {}

  createSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = createChatSessionSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const { data, error } = await this.supabase
        .from("chat_sessions")
        .insert({
          user_id: userId,
          title: parsed.data.title ?? "New Session",
          last_message_at: null,
        })
        .select("id, title, summary, last_message_at, created_at")
        .single();

      if (error || !data) {
        throw new AppError(
          `Failed to create chat session: ${error?.message ?? "unknown"}`,
          500,
        );
      }

      res.status(201).json({
        status: "success",
        data: {
          id: String(data.id),
          title: typeof data.title === "string" ? data.title : null,
          summary: typeof data.summary === "string" ? data.summary : null,
          lastMessageAt:
            typeof data.last_message_at === "string"
              ? data.last_message_at
              : null,
          createdAt: String(data.created_at),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  listSessions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = chatSessionsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      let query = this.supabase
        .from("chat_sessions")
        .select("id, title, summary, last_message_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(parsed.data.limit + 1);

      if (parsed.data.cursor) {
        query = query.lt("created_at", parsed.data.cursor);
      }

      const { data, error } = await query;
      if (error) {
        throw new AppError(
          `Failed to fetch chat sessions: ${error.message}`,
          500,
        );
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const hasMore = rows.length > parsed.data.limit;
      const items = hasMore ? rows.slice(0, parsed.data.limit) : rows;
      const nextCursor = hasMore
        ? String(items[items.length - 1]?.created_at ?? "") || null
        : null;

      res.json({
        status: "success",
        data: {
          items: items.map((row) => ({
            id: String(row.id),
            title: typeof row.title === "string" ? row.title : null,
            summary: typeof row.summary === "string" ? row.summary : null,
            lastMessageAt:
              typeof row.last_message_at === "string"
                ? row.last_message_at
                : null,
            createdAt: String(row.created_at),
          })),
          nextCursor,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  sendMessage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = sendChatMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const { data: session, error: sessionError } = await this.supabase
        .from("chat_sessions")
        .select("id")
        .eq("id", parsed.data.sessionId)
        .eq("user_id", userId)
        .single();

      if (sessionError || !session) {
        throw new NotFoundError("Chat session");
      }

      const now = new Date().toISOString();

      const { error: userMessageError } = await this.supabase
        .from("chat_messages")
        .insert({
          user_id: userId,
          session_id: parsed.data.sessionId,
          role: "user",
          content: parsed.data.message,
        });

      if (userMessageError) {
        throw new AppError(
          `Failed to store user message: ${userMessageError.message}`,
          500,
        );
      }

      const assistantMessage = createCompanionResponse(parsed.data.message);

      const { error: assistantError } = await this.supabase
        .from("chat_messages")
        .insert({
          user_id: userId,
          session_id: parsed.data.sessionId,
          role: "assistant",
          content: assistantMessage,
          model: "mock-companion-v1",
        });

      if (assistantError) {
        throw new AppError(
          `Failed to store assistant message: ${assistantError.message}`,
          500,
        );
      }

      const { error: updateSessionError } = await this.supabase
        .from("chat_sessions")
        .update({ last_message_at: now })
        .eq("id", parsed.data.sessionId)
        .eq("user_id", userId);

      if (updateSessionError) {
        throw new AppError(
          `Failed to update chat session: ${updateSessionError.message}`,
          500,
        );
      }

      res.json({
        status: "success",
        data: {
          sessionId: parsed.data.sessionId,
          assistantMessage,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  listMessages = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = chatMessagesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const { data: session, error: sessionError } = await this.supabase
        .from("chat_sessions")
        .select("id")
        .eq("id", parsed.data.sessionId)
        .eq("user_id", userId)
        .single();

      if (sessionError || !session) {
        throw new NotFoundError("Chat session");
      }

      let query = this.supabase
        .from("chat_messages")
        .select("id, session_id, role, content, model, created_at")
        .eq("user_id", userId)
        .eq("session_id", parsed.data.sessionId)
        .order("created_at", { ascending: false })
        .limit(parsed.data.limit + 1);

      if (parsed.data.cursor) {
        query = query.lt("created_at", parsed.data.cursor);
      }

      const { data, error } = await query;
      if (error) {
        throw new AppError(
          `Failed to fetch chat messages: ${error.message}`,
          500,
        );
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const hasMore = rows.length > parsed.data.limit;
      const items = hasMore ? rows.slice(0, parsed.data.limit) : rows;
      const nextCursor = hasMore
        ? String(items[items.length - 1]?.created_at ?? "") || null
        : null;

      res.json({
        status: "success",
        data: {
          items: items.map((row) => ({
            id: String(row.id),
            sessionId: String(row.session_id),
            role: String(row.role),
            content: String(row.content),
            model: typeof row.model === "string" ? row.model : null,
            createdAt: String(row.created_at),
          })),
          nextCursor,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // Backward-compatible aliases
  send = this.sendMessage;
  history = this.listMessages;
}

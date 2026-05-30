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
import type { AiGatewayClient } from "../../../../infrastructure/ai/AiGatewayClient.js";
import {
  chatMessagesQuerySchema,
  chatSessionsQuerySchema,
  createChatSessionSchema,
  sendChatMessageSchema,
} from "../validation/chatSchemas.js";
import {
  decryptField,
  encryptField,
} from "../../../shared/infrastructure/utils/fieldEncryption.js";
import {
  buildAssistantStoredContent,
  createCompanionFallbackResponse,
  createJsonTokenStreamState,
  extractResponseTextFromJsonTokens,
  parseAssistantStoredContent,
  sanitizeCompanionDataEvent,
  tryParseCompanionData,
  unwrapAssistantPayload,
} from "../../application/services/CompanionMessageService.js";

export class ChatController {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly aiClient: AiGatewayClient,
  ) {}

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
          content: encryptField(parsed.data.message),
        });

      if (userMessageError) {
        throw new AppError(
          `Failed to store user message: ${userMessageError.message}`,
          500,
        );
      }

      let assistantMessage = "";
      let assistantRecommendations: string[] = [];
      let assistantModel = "vitara-ai-companion";

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const streamResponse = await this.aiClient.chatCompanionStream(
          parsed.data.message,
          userId,
        );

        if (streamResponse.body) {
          const reader = streamResponse.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          const jsonTokenState = createJsonTokenStreamState();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // SSE events are separated by blank lines.
            const parts = buffer.split(/\n\n+/);
            buffer = parts.pop() ?? "";

            for (const eventBlock of parts) {
              const dataLines = eventBlock
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trim())
                .filter(Boolean);

              if (dataLines.length === 0) continue;

              // The AI service uses JSON in data lines. Join to handle multi-line JSON.
              const dataStr = dataLines.join("\n");
              const parsedData = tryParseCompanionData(dataStr);
              if (!parsedData) continue;

              if ("token" in parsedData) {
                const streamed = extractResponseTextFromJsonTokens(
                  parsedData.token,
                  jsonTokenState,
                );
                if (streamed.length === 0) continue;
                res.write(`data: ${JSON.stringify({ token: streamed })}\n\n`);
                assistantMessage += streamed;
                continue;
              }

              const sanitized = sanitizeCompanionDataEvent(parsedData);
              res.write(`data: ${JSON.stringify(sanitized)}\n\n`);
              assistantMessage =
                "full_response" in sanitized ? sanitized.full_response : assistantMessage;
              if ("recommendations" in sanitized && Array.isArray(sanitized.recommendations)) {
                assistantRecommendations = sanitized.recommendations;
              }
            }
          }

          // Flush any remaining buffered event.
          const tail = buffer.trim();
          if (tail.length > 0) {
            const dataLines = tail
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim())
              .filter(Boolean);
            if (dataLines.length > 0) {
              const parsedData = tryParseCompanionData(dataLines.join("\n"));
              if (parsedData) {
                if ("token" in parsedData) {
                  const streamed = extractResponseTextFromJsonTokens(
                    parsedData.token,
                    jsonTokenState,
                  );
                  if (streamed.length > 0) {
                    res.write(`data: ${JSON.stringify({ token: streamed })}\n\n`);
                    assistantMessage += streamed;
                  }
                } else {
                  const sanitized = sanitizeCompanionDataEvent(parsedData);
                  res.write(`data: ${JSON.stringify(sanitized)}\n\n`);
                  assistantMessage =
                    "full_response" in sanitized ? sanitized.full_response : assistantMessage;
                  if (
                    "recommendations" in sanitized &&
                    Array.isArray(sanitized.recommendations)
                  ) {
                    assistantRecommendations = sanitized.recommendations;
                  }
                }
              }
            }
          }
        }
      } catch {
        assistantMessage = createCompanionFallbackResponse(parsed.data.message);
        assistantModel = "local-companion-fallback";
        res.write(`data: ${JSON.stringify({ full_response: assistantMessage })}\n\n`);
      }

      res.end();

      assistantMessage = buildAssistantStoredContent(
        unwrapAssistantPayload(assistantMessage).response,
        assistantRecommendations,
      );

      const { error: assistantError } = await this.supabase
        .from("chat_messages")
        .insert({
          user_id: userId,
          session_id: parsed.data.sessionId,
          role: "assistant",
          content: encryptField(assistantMessage),
          model: assistantModel,
        });

      if (assistantError) {
        console.error(`Failed to store assistant message: ${assistantError.message}`);
      }

      const { error: updateSessionError } = await this.supabase
        .from("chat_sessions")
        .update({ last_message_at: now })
        .eq("id", parsed.data.sessionId)
        .eq("user_id", userId);

      if (updateSessionError) {
        console.error(`Failed to update chat session: ${updateSessionError.message}`);
      }
    } catch (err) {
      if (!res.headersSent) {
        next(err);
      } else {
        console.error("Error during chat stream:", err);
        res.end();
      }
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
          items: items.map((row) => {
            const role = String(row.role);
            const decryptedContent = decryptField(String(row.content));
            const parsedContent =
              role === "assistant"
                ? parseAssistantStoredContent(decryptedContent)
                : { response: decryptedContent, recommendations: undefined };

            return {
              id: String(row.id),
              sessionId: String(row.session_id),
              role,
              content: parsedContent.response,
              recommendations: parsedContent.recommendations ?? null,
              model: typeof row.model === "string" ? row.model : null,
              createdAt: String(row.created_at),
            };
          }),
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

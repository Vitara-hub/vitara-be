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

function sanitizeTextForStorage(input: string): string {
  // Remove NULL bytes and other non-text control chars (keep \n \r \t).
  const stripped = input
    .split("\u0000")
    .join("")
    .replace(/[^\P{C}\n\r\t]+/gu, "")
    .trim();

  // Collapse excessive whitespace but preserve new lines reasonably.
  const normalized = stripped
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  // Guard rail to avoid storing megabytes if model goes wild.
  const MAX_LEN = 8000;
  return normalized.length > MAX_LEN ? `${normalized.slice(0, MAX_LEN)}…` : normalized;
}

export type AssistantResponsePayload = {
  response: string;
  recommendations?: string[];
};

export function buildAssistantStoredContent(
  response: string,
  recommendations?: string[],
): string {
  const sanitizedResponse = sanitizeTextForStorage(response);
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return sanitizedResponse;
  }

  const normalizedRecommendations = recommendations
    .map((item) => sanitizeTextForStorage(item))
    .filter((item) => item.length > 0);

  if (normalizedRecommendations.length === 0) {
    return sanitizedResponse;
  }

  const recommendationBlock = normalizedRecommendations
    .map((item) => `- ${item}`)
    .join("\n");

  return `${sanitizedResponse}\n\nRecommendations:\n${recommendationBlock}`;
}

export function parseAssistantStoredContent(content: string): AssistantResponsePayload {
  const normalized = sanitizeTextForStorage(content);
  const marker = "\n\nRecommendations:\n";
  const markerIndex = normalized.indexOf(marker);

  if (markerIndex === -1) {
    return { response: normalized };
  }

  const response = normalized.slice(0, markerIndex).trim();
  const recommendationRaw = normalized.slice(markerIndex + marker.length);
  const recommendations = recommendationRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => sanitizeTextForStorage(line.slice(2)))
    .filter((line) => line.length > 0);

  return {
    response,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  };
}

function payloadFromParsedAssistantJson(
  parsed: Record<string, unknown>,
): AssistantResponsePayload | null {
  const fromAssistantMessage =
    typeof parsed.assistantMessage === "string" ? parsed.assistantMessage : null;
  const fromResponse = typeof parsed.response === "string" ? parsed.response : null;

  if (!fromAssistantMessage && !fromResponse) {
    return null;
  }

  const recommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : undefined;

  return {
    response: String(fromAssistantMessage ?? fromResponse ?? ""),
    recommendations,
  };
}

export function unwrapAssistantPayload(text: string): AssistantResponsePayload {
  const candidate = text.trim();

  // Direct JSON response.
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const payload = payloadFromParsedAssistantJson(parsed);
    if (payload) return payload;
  } catch {
    // ignore
  }

  // Markdown fenced JSON block.
  const jsonBlockMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1] ?? "{}") as Record<string, unknown>;
      const payload = payloadFromParsedAssistantJson(parsed);
      if (payload) return payload;
    } catch {
      // ignore
    }
  }

  return { response: candidate };
}

function unwrapAssistantJson(text: string): string {
  return unwrapAssistantPayload(text).response;
}

type CompanionSseData =
  | { token: string }
  | { full_response: string; recommendations?: unknown };

type JsonTokenStreamState = {
  enabled: boolean;
  seenFence: boolean;
  buffer: string;
  capturing: boolean;
  done: boolean;
  escape: boolean;
};

function createJsonTokenStreamState(): JsonTokenStreamState {
  return {
    enabled: false,
    seenFence: false,
    buffer: "",
    capturing: false,
    done: false,
    escape: false,
  };
}

/**
 * Some model responses stream as a markdown-fenced JSON blob in `token` events.
 * This extracts only the `response` string value for better UX.
 */
function extractResponseTextFromJsonTokens(
  tokenChunk: string,
  state: JsonTokenStreamState,
): string {
  if (state.done) return "";

  const chunk = tokenChunk ?? "";
  const fenceMatch = chunk.includes("```json") || chunk.includes("```");
  const looksJson =
    fenceMatch ||
    chunk.includes("\"response\"") ||
    (state.buffer.length === 0 && chunk.trimStart().startsWith("{"));

  if (!state.enabled && looksJson) {
    state.enabled = true;
  }

  if (!state.enabled) {
    // Not JSON streaming; just sanitize raw token.
    return sanitizeTextForStorage(chunk);
  }

  if (fenceMatch) state.seenFence = true;

  state.buffer += chunk;
  // Keep buffer bounded.
  if (state.buffer.length > 20000) {
    state.buffer = state.buffer.slice(-20000);
  }

  // Find start of response string.
  if (!state.capturing) {
    const idx = state.buffer.indexOf("\"response\"");
    if (idx === -1) return "";

    // Find first quote of the value:  "response" : "<here>"
    const colon = state.buffer.indexOf(":", idx);
    if (colon === -1) return "";
    const firstQuote = state.buffer.indexOf("\"", colon);
    if (firstQuote === -1) return "";

    state.capturing = true;
    state.escape = false;
    // Drop everything before the first character inside the string value.
    state.buffer = state.buffer.slice(firstQuote + 1);
  }

  // Now buffer begins inside the JSON string value. Emit until closing unescaped quote.
  let out = "";
  let i = 0;
  for (; i < state.buffer.length; i++) {
    const ch = state.buffer[i]!;
    if (state.escape) {
      // Minimal unescape for common sequences.
      if (ch === "n") out += "\n";
      else if (ch === "r") out += "\r";
      else if (ch === "t") out += "\t";
      else out += ch;
      state.escape = false;
      continue;
    }

    if (ch === "\\") {
      state.escape = true;
      continue;
    }

    if (ch === "\"") {
      state.done = true;
      i++; // consume closing quote
      break;
    }

    out += ch;
  }

  // Remove consumed portion.
  state.buffer = state.buffer.slice(i);

  return sanitizeTextForStorage(out);
}

function tryParseCompanionData(raw: string): CompanionSseData | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.token === "string") return { token: parsed.token };
    if (typeof parsed.full_response === "string") {
      return {
        full_response: parsed.full_response,
        recommendations: parsed.recommendations,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function sanitizeCompanionDataEvent(data: CompanionSseData): CompanionSseData {
  if ("token" in data) {
    return { token: sanitizeTextForStorage(data.token) };
  }

  const payload = unwrapAssistantPayload(data.full_response);
  const rawRecommendations = Array.isArray(data.recommendations)
    ? data.recommendations
    : payload.recommendations;
  const recs =
    Array.isArray(rawRecommendations)
      ? rawRecommendations
          .filter((item): item is string => typeof item === "string")
          .map((item) => sanitizeTextForStorage(item))
          .filter((item) => item.length > 0)
          .slice(0, 6)
      : undefined;

  return {
    full_response: sanitizeTextForStorage(payload.response),
    recommendations: recs,
  };
}

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
          content: parsed.data.message,
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
        assistantMessage = sanitizeTextForStorage(createCompanionResponse(parsed.data.message));
        assistantModel = "local-companion-fallback";
        res.write(`data: ${JSON.stringify({ full_response: assistantMessage })}\n\n`);
      }

      res.end();

      assistantMessage = buildAssistantStoredContent(
        unwrapAssistantJson(assistantMessage),
        assistantRecommendations,
      );

      const { error: assistantError } = await this.supabase
        .from("chat_messages")
        .insert({
          user_id: userId,
          session_id: parsed.data.sessionId,
          role: "assistant",
          content: assistantMessage,
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
            const parsedContent =
              role === "assistant"
                ? parseAssistantStoredContent(String(row.content))
                : { response: String(row.content), recommendations: undefined };

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

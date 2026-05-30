import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import { AppError, BadRequestError } from "../../../../core/errors/AppError.js";
import type { AiGatewayClient } from "../../../../infrastructure/ai/AiGatewayClient.js";
import { getDayBoundaries } from "../../../shared/infrastructure/utils/dateUtils.js";
import {
  decryptField,
  encryptField,
} from "../../../shared/infrastructure/utils/fieldEncryption.js";
import {
  parseValidationError,
  requireUserId,
} from "../../../shared/infrastructure/utils/requestUtils.js";
import {
  journalAnalyzeSchema,
  journalListQuerySchema,
  typingAnalyzeSchema,
  typingListQuerySchema,
} from "../validation/typingSchemas.js";

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

function parseJournalMeta(value: unknown): {
  emotion: string;
  topics: string[];
} {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const emotion =
      typeof record.emotion === "string" && record.emotion.length > 0
        ? record.emotion
        : "neutral";

    return {
      emotion,
      topics: safeStringArray(record.topics),
    };
  }

  return {
    emotion: "neutral",
    topics: safeStringArray(value),
  };
}

export class TypingController {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly aiClient: AiGatewayClient,
  ) {}

  analyze = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = typingAnalyzeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const prediction = await this.aiClient.predictTyping(
        {
          wpm: parsed.data.wpm,
          backspaceRate: parsed.data.backspaceRate,
          interKeyTimings: parsed.data.interKeyTimings,
        },
        userId,
      );

      const { data, error } = await this.supabase
        .from("typing_sessions")
        .insert({
          user_id: userId,
          wpm: parsed.data.wpm,
          duration: parsed.data.duration,
          text_content: encryptField(parsed.data.textContent),
          backspace_rate: parsed.data.backspaceRate,
          inter_key_timing: parsed.data.interKeyTimings,
          stress_score: prediction.stressScore,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new AppError(
          `Failed to create typing session: ${error?.message ?? "unknown"}`,
          500,
        );
      }

      res.json({
        status: "success",
        data: {
          sessionId: String(data.id),
          stressScore: prediction.stressScore,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  list = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = typingListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      let query = this.supabase
        .from("typing_sessions")
        .select(
          "id, wpm, duration, text_content, backspace_rate, inter_key_timing, stress_score, created_at",
        )
        .eq("user_id", userId)
        .gt("duration", 0)
        .order("created_at", { ascending: false })
        .limit(parsed.data.limit + 1);

      if (parsed.data.cursor) {
        query = query.lt("created_at", parsed.data.cursor);
      }

      if (parsed.data.date) {
        const boundaries = getDayBoundaries(parsed.data.date);
        query = query
          .gte("created_at", boundaries.startIso)
          .lte("created_at", boundaries.endIso);
      }

      const { data, error } = await query;
      if (error) {
        throw new AppError(
          `Failed to fetch typing sessions: ${error.message}`,
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
            wpm: Number(row.wpm),
            duration: Number(row.duration),
            textContent: decryptField(String(row.text_content)),
            backspaceRate:
              typeof row.backspace_rate === "number"
                ? Number(row.backspace_rate)
                : null,
            interKeyTimings: Array.isArray(row.inter_key_timing)
              ? row.inter_key_timing
              : [],
            stressScore:
              typeof row.stress_score === "number"
                ? Number(row.stress_score)
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

  analyzeJournal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = journalAnalyzeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const prediction = await this.aiClient.predictJournal(
        parsed.data.text,
        userId,
      );

      // Journal data disimpan di typing_sessions agar tetap di existing module.
      const { data, error } = await this.supabase
        .from("typing_sessions")
        .insert({
          user_id: userId,
          wpm: 0,
          duration: 0,
          text_content: encryptField(parsed.data.text),
          backspace_rate: null,
          inter_key_timing: {
            emotion: prediction.emotion,
            topics: prediction.topics,
            kind: "journal",
          },
          stress_score: prediction.stressLevel,
        })
        .select("id, created_at")
        .single();

      if (error || !data) {
        throw new AppError(
          `Failed to save journal analysis: ${error?.message ?? "unknown"}`,
          500,
        );
      }

      res.json({
        status: "success",
        data: {
          entryId: String(data.id),
          emotion: prediction.emotion,
          stressLevel: prediction.stressLevel,
          topics: prediction.topics,
          createdAt: String(data.created_at),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  listJournal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = journalListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      let query = this.supabase
        .from("typing_sessions")
        .select("id, text_content, stress_score, inter_key_timing, created_at")
        .eq("user_id", userId)
        .eq("duration", 0)
        .order("created_at", { ascending: false })
        .limit(parsed.data.limit + 1);

      if (parsed.data.cursor) {
        query = query.lt("created_at", parsed.data.cursor);
      }

      const { data, error } = await query;
      if (error) {
        throw new AppError(
          `Failed to fetch journal logs: ${error.message}`,
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
            const meta = parseJournalMeta(row.inter_key_timing);

            return {
              id: String(row.id),
              text: decryptField(String(row.text_content)),
              emotion: meta.emotion,
              stressLevel:
                typeof row.stress_score === "number"
                  ? Number(row.stress_score)
                  : null,
              topics: meta.topics,
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

  // Backward-compatible alias
  create = this.analyze;
}

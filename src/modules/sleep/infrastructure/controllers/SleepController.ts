import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import { AppError, BadRequestError } from "../../../../core/errors/AppError.js";
import type { AiGatewayClient } from "../../../../infrastructure/ai/AiGatewayClient.js";
import {
  clamp,
  deriveSleepWindow,
  getDayBoundaries,
} from "../../../shared/infrastructure/utils/dateUtils.js";
import {
  decryptField,
  encryptField,
} from "../../../shared/infrastructure/utils/fieldEncryption.js";
import {
  parseValidationError,
  requireUserId,
} from "../../../shared/infrastructure/utils/requestUtils.js";
import {
  sleepAnalyzeSchema,
  sleepListQuerySchema,
} from "../validation/sleepSchemas.js";

export class SleepController {
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
      const parsed = sleepAnalyzeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const window = deriveSleepWindow(
        parsed.data.sleepTime,
        parsed.data.wakeTime,
      );
      const prediction = await this.aiClient.predictSleep(
        {
          durationHours: window.durationHours,
          bedtime: parsed.data.sleepTime,
          wakeTime: parsed.data.wakeTime,
          interruptions: parsed.data.interruptions,
        },
        userId,
      );

      const qualityForScaleFive = clamp(
        Math.round(prediction.qualityScore / 20),
        1,
        5,
      );

      const { data, error } = await this.supabase
        .from("sleep_entries")
        .insert({
          user_id: userId,
          start_time: window.start.toISOString(),
          end_time: window.end.toISOString(),
          quality: qualityForScaleFive,
          notes: parsed.data.notes ? encryptField(parsed.data.notes) : null,
          ai_quality_score: prediction.qualityScore,
          sleep_debt_hours: null,
          interruptions: parsed.data.interruptions,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new AppError(
          `Failed to create sleep entry: ${error?.message ?? "unknown"}`,
          500,
        );
      }

      res.json({
        status: "success",
        data: {
          entryId: String(data.id),
          durationHours: window.durationHours,
          qualityScore: prediction.qualityScore,
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
      const parsed = sleepListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      let query = this.supabase
        .from("sleep_entries")
        .select(
          "id, start_time, end_time, quality, notes, ai_quality_score, sleep_debt_hours, interruptions, created_at",
        )
        .eq("user_id", userId)
        .order("start_time", { ascending: false })
        .limit(parsed.data.limit + 1);

      if (parsed.data.cursor) {
        query = query.lt("start_time", parsed.data.cursor);
      }

      if (parsed.data.date) {
        const boundaries = getDayBoundaries(parsed.data.date);
        query = query
          .gte("start_time", boundaries.startIso)
          .lte("start_time", boundaries.endIso);
      }

      const { data, error } = await query;
      if (error) {
        throw new AppError(
          `Failed to fetch sleep entries: ${error.message}`,
          500,
        );
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const hasMore = rows.length > parsed.data.limit;
      const items = hasMore ? rows.slice(0, parsed.data.limit) : rows;
      const nextCursor = hasMore
        ? String(items[items.length - 1]?.start_time ?? "") || null
        : null;

      res.json({
        status: "success",
        data: {
          items: items.map((row) => ({
            id: String(row.id),
            startTime: String(row.start_time),
            endTime: String(row.end_time),
            quality: Number(row.quality),
            notes:
              typeof row.notes === "string" ? decryptField(row.notes) : null,
            qualityScore:
              typeof row.ai_quality_score === "number"
                ? Number(row.ai_quality_score)
                : null,
            sleepDebtHours:
              typeof row.sleep_debt_hours === "number"
                ? Number(row.sleep_debt_hours)
                : null,
            interruptions:
              typeof row.interruptions === "number"
                ? Number(row.interruptions)
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

  // Backward-compatible aliases for previous naming.
  create = this.analyze;
}

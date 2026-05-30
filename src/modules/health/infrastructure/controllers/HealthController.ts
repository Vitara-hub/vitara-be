import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import { AppError, BadRequestError } from "../../../../core/errors/AppError.js";
import { toUtcDateOnly } from "../../../shared/infrastructure/utils/dateUtils.js";
import {
  mapEmotionLabel,
  mapHealthStatusLabel,
  mapStressLabel,
} from "../../../shared/infrastructure/utils/healthPresentation.js";
import {
  parseValidationError,
  requireUserId,
} from "../../../shared/infrastructure/utils/requestUtils.js";
import { HealthSnapshotService } from "../../application/services/HealthSnapshotService.js";
import {
  activityRecentQuerySchema,
  activitySummaryQuerySchema,
  healthDailyQuerySchema,
} from "../validation/healthSchemas.js";

export class HealthController {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly snapshotService: HealthSnapshotService,
  ) {}

  compute = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const dateOnly = toUtcDateOnly(new Date());
      const snapshot = await this.snapshotService.computeAndUpsertHealth(
        userId,
        dateOnly,
      );

      res.json({
        status: "success",
        data: {
          snapshotDate: String(snapshot.snapshot_date),
          healthScore: Number(snapshot.overall_health_score),
          breakdown: {
            mood: Number(snapshot.mood_score),
            nutrition: Number(snapshot.nutrition_score),
            sleep: Number(snapshot.sleep_score),
            stress: Number(snapshot.stress_score),
          },
          insightSummary:
            typeof snapshot.insight_summary === "string"
              ? snapshot.insight_summary
              : null,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  daily = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = healthDailyQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const today = toUtcDateOnly(new Date());
      const defaultFrom = toUtcDateOnly(
        new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      );

      const from = parsed.data.from ?? defaultFrom;
      const to = parsed.data.to ?? today;

      const { data, error } = await this.supabase
        .from("daily_health_snapshots")
        .select(
          "id, snapshot_date, mood_score, nutrition_score, sleep_score, stress_score, overall_health_score, insight_summary, created_at",
        )
        .eq("user_id", userId)
        .gte("snapshot_date", from)
        .lte("snapshot_date", to)
        .order("snapshot_date", { ascending: true });

      if (error) {
        throw new AppError(
          `Failed to fetch daily health snapshots: ${error.message}`,
          500,
        );
      }

      res.json({
        status: "success",
        data: (data ?? []).map((row) => ({
          id: String(row.id),
          snapshotDate: String(row.snapshot_date),
          healthScore: Number(row.overall_health_score),
          breakdown: {
            mood: Number(row.mood_score),
            nutrition: Number(row.nutrition_score),
            sleep: Number(row.sleep_score),
            stress: Number(row.stress_score),
          },
          insightSummary:
            typeof row.insight_summary === "string"
              ? row.insight_summary
              : null,
          createdAt: String(row.created_at),
        })),
      });
    } catch (err) {
      next(err);
    }
  };

  dashboardToday = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const dateOnly = toUtcDateOnly(new Date());

      const { data: existing, error: existingError } = await this.supabase
        .from("daily_health_snapshots")
        .select(
          "snapshot_date, mood_score, nutrition_score, sleep_score, stress_score, overall_health_score, insight_summary",
        )
        .eq("user_id", userId)
        .eq("snapshot_date", dateOnly)
        .maybeSingle();

      if (existingError) {
        throw new AppError(
          `Failed to fetch dashboard snapshot: ${existingError.message}`,
          500,
        );
      }

      const snapshot = existing
        ? (existing as Record<string, unknown>)
        : await this.snapshotService.computeAndUpsertHealth(userId, dateOnly);

      const dailyInputs = await this.snapshotService.collectDailyInputs(
        userId,
        dateOnly,
      );
      const healthScore = Number(snapshot.overall_health_score);
      const status = mapHealthStatusLabel(healthScore);

      const dateLabel = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date());

      res.json({
        status: "success",
        data: {
          dateLabel,
          healthScore,
          statusLabel: status.statusLabel,
          suggestion:
            typeof snapshot.insight_summary === "string" &&
            snapshot.insight_summary.length > 0
              ? snapshot.insight_summary
              : status.suggestion,
          breakdown: {
            moodLabel: mapEmotionLabel(dailyInputs.emotion ?? "neutral"),
            stressLabel: mapStressLabel(
              typeof snapshot.stress_score === "number"
                ? Number(snapshot.stress_score)
                : 0,
            ),
            nutritionKcal: Math.round(dailyInputs.nutritionCalories ?? 0),
            sleepHours: dailyInputs.sleepHours,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  };

  activitySummary = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = activitySummaryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const days = parsed.data.period === "30d" ? 30 : 7;
      const toDate = new Date();
      const fromDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);

      const from = toUtcDateOnly(fromDate);
      const to = toUtcDateOnly(toDate);

      const { data, error } = await this.supabase
        .from("daily_health_snapshots")
        .select("snapshot_date, overall_health_score")
        .eq("user_id", userId)
        .gte("snapshot_date", from)
        .lte("snapshot_date", to)
        .order("snapshot_date", { ascending: true });

      if (error) {
        throw new AppError(
          `Failed to fetch activity summary: ${error.message}`,
          500,
        );
      }

      const scores = (data ?? []).map((row) =>
        Number(row.overall_health_score),
      );
      const averageHealthScore =
        scores.length > 0
          ? Math.round(
              scores.reduce((acc, curr) => acc + curr, 0) / scores.length,
            )
          : 0;

      const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
      const worstScore = scores.length > 0 ? Math.min(...scores) : 0;

      res.json({
        status: "success",
        data: {
          period: parsed.data.period,
          averageHealthScore,
          daysTracked: scores.length,
          bestScore,
          worstScore,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  activityRecent = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = activityRecentQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      let foodQuery = this.supabase
        .from("food_entries")
        .select("id, consumed_at, name, calories")
        .eq("user_id", userId)
        .order("consumed_at", { ascending: false })
        .limit(parsed.data.limit);

      let sleepQuery = this.supabase
        .from("sleep_entries")
        .select("id, start_time, end_time, ai_quality_score")
        .eq("user_id", userId)
        .order("start_time", { ascending: false })
        .limit(parsed.data.limit);

      let typingQuery = this.supabase
        .from("typing_sessions")
        .select("id, created_at, stress_score, wpm, duration, inter_key_timing")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(parsed.data.limit);

      if (parsed.data.cursor) {
        foodQuery = foodQuery.lt("consumed_at", parsed.data.cursor);
        sleepQuery = sleepQuery.lt("start_time", parsed.data.cursor);
        typingQuery = typingQuery.lt("created_at", parsed.data.cursor);
      }

      const [foodRes, sleepRes, typingRes] = await Promise.all([
        foodQuery,
        sleepQuery,
        typingQuery,
      ]);

      if (foodRes.error || sleepRes.error || typingRes.error) {
        throw new AppError("Failed to fetch recent activity", 500);
      }

      const typingRows = typingRes.data ?? [];
      const journalItems = typingRows
        .filter((row) => Number(row.duration) === 0)
        .map((row) => {
          const journalMeta =
            row.inter_key_timing &&
            typeof row.inter_key_timing === "object" &&
            !Array.isArray(row.inter_key_timing)
              ? (row.inter_key_timing as Record<string, unknown>)
              : null;

          return {
            id: String(row.id),
            type: "journal",
            createdAt: String(row.created_at),
            title: "Journal entry",
            meta: {
              emotion:
                journalMeta && typeof journalMeta.emotion === "string"
                  ? journalMeta.emotion
                  : "neutral",
              stressLevel:
                typeof row.stress_score === "number"
                  ? Number(row.stress_score)
                  : null,
            },
          };
        });

      const typingItems = typingRows
        .filter((row) => Number(row.duration) > 0)
        .map((row) => ({
          id: String(row.id),
          type: "typing",
          createdAt: String(row.created_at),
          title: "Typing session",
          meta: {
            stressScore:
              typeof row.stress_score === "number"
                ? Number(row.stress_score)
                : null,
            wpm: typeof row.wpm === "number" ? Number(row.wpm) : null,
          },
        }));

      const items = [
        ...(foodRes.data ?? []).map((row) => ({
          id: String(row.id),
          type: "food",
          createdAt: String(row.consumed_at),
          title: String(row.name),
          meta: {
            calories:
              typeof row.calories === "number" ? Number(row.calories) : null,
          },
        })),
        ...(sleepRes.data ?? []).map((row) => ({
          id: String(row.id),
          type: "sleep",
          createdAt: String(row.start_time),
          title: "Sleep log",
          meta: {
            qualityScore:
              typeof row.ai_quality_score === "number"
                ? Number(row.ai_quality_score)
                : null,
            endTime: typeof row.end_time === "string" ? row.end_time : null,
          },
        })),
        ...typingItems,
        ...journalItems,
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      const sliced = items.slice(0, parsed.data.limit);
      const nextCursor =
        items.length > parsed.data.limit
          ? (sliced[sliced.length - 1]?.createdAt ?? null)
          : null;

      res.json({
        status: "success",
        data: {
          items: sliced,
          nextCursor,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

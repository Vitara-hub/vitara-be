import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../../../core/errors/AppError.js";
import {
  type AiGatewayClient,
  type HealthComputationInput,
} from "../../../../infrastructure/ai/AiGatewayClient.js";
import {
  clamp,
  getDayBoundaries,
} from "../../../shared/infrastructure/utils/dateUtils.js";
import { mapHealthStatusLabel } from "../../../shared/infrastructure/utils/healthPresentation.js";

export interface DailyInputs {
  emotion: string | null;
  journalStressLevel: number | null;
  nutritionCalories: number | null;
  sleepQualityScore: number | null;
  typingStressScore: number | null;
  sleepHours: number;
}

function normalizePercentScore(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value <= 1 ? value * 100 : value;
}

export class HealthSnapshotService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly aiClient: AiGatewayClient,
  ) {}

  async collectDailyInputs(
    userId: string,
    dateOnly: string,
  ): Promise<DailyInputs> {
    const boundaries = getDayBoundaries(dateOnly);

    const journalQuery = this.supabase
      .from("typing_sessions")
      .select("stress_score, inter_key_timing, created_at")
      .eq("user_id", userId)
      .eq("duration", 0)
      .gte("created_at", boundaries.startIso)
      .lte("created_at", boundaries.endIso)
      .order("created_at", { ascending: false })
      .limit(1);

    const foodQuery = this.supabase
      .from("food_entries")
      .select("calories")
      .eq("user_id", userId)
      .gte("consumed_at", boundaries.startIso)
      .lte("consumed_at", boundaries.endIso);

    const sleepQuery = this.supabase
      .from("sleep_entries")
      .select("start_time, end_time, ai_quality_score")
      .eq("user_id", userId)
      .order("start_time", { ascending: false })
      .limit(1);

    const typingQuery = this.supabase
      .from("typing_sessions")
      .select("stress_score, created_at")
      .eq("user_id", userId)
      .gt("duration", 0)
      .gte("created_at", boundaries.startIso)
      .lte("created_at", boundaries.endIso)
      .order("created_at", { ascending: false })
      .limit(1);

    const [journalResult, foodResult, sleepResult, typingResult] =
      await Promise.all([journalQuery, foodQuery, sleepQuery, typingQuery]);

    if (journalResult.error) {
      throw new AppError(
        `Failed to fetch journal metrics: ${journalResult.error.message}`,
        500,
      );
    }

    if (foodResult.error) {
      throw new AppError(
        `Failed to fetch nutrition metrics: ${foodResult.error.message}`,
        500,
      );
    }

    if (sleepResult.error) {
      throw new AppError(
        `Failed to fetch sleep metrics: ${sleepResult.error.message}`,
        500,
      );
    }

    if (typingResult.error) {
      throw new AppError(
        `Failed to fetch typing metrics: ${typingResult.error.message}`,
        500,
      );
    }

    const journalRow = (journalResult.data?.[0] ?? null) as Record<
      string,
      unknown
    > | null;

    const sleepRow = (sleepResult.data?.[0] ?? null) as Record<
      string,
      unknown
    > | null;
    const typingRow = (typingResult.data?.[0] ?? null) as Record<
      string,
      unknown
    > | null;

    const nutritionCalories = (foodResult.data ?? []).reduce((acc, row) => {
      const calories = typeof row.calories === "number" ? row.calories : 0;
      return acc + calories;
    }, 0);

    const sleepStart =
      sleepRow && typeof sleepRow.start_time === "string"
        ? new Date(sleepRow.start_time)
        : null;

    const sleepEnd =
      sleepRow && typeof sleepRow.end_time === "string"
        ? new Date(sleepRow.end_time)
        : null;

    const sleepHours =
      sleepStart && sleepEnd
        ? clamp((sleepEnd.getTime() - sleepStart.getTime()) / 3_600_000, 0, 24)
        : 0;

    const journalMeta =
      journalRow &&
      journalRow.inter_key_timing &&
      typeof journalRow.inter_key_timing === "object" &&
      !Array.isArray(journalRow.inter_key_timing)
        ? (journalRow.inter_key_timing as Record<string, unknown>)
        : null;

    return {
      emotion:
        journalMeta && typeof journalMeta.emotion === "string"
          ? journalMeta.emotion
          : null,
      journalStressLevel:
        journalRow && typeof journalRow.stress_score === "number"
          ? clamp(journalRow.stress_score, 0, 1)
          : null,
      nutritionCalories: nutritionCalories > 0 ? nutritionCalories : null,
      sleepQualityScore:
        sleepRow && typeof sleepRow.ai_quality_score === "number"
          ? clamp(normalizePercentScore(sleepRow.ai_quality_score) ?? 0, 0, 100)
          : null,
      typingStressScore:
        typingRow && typeof typingRow.stress_score === "number"
          ? clamp(typingRow.stress_score, 0, 1)
          : null,
      sleepHours: Math.round(sleepHours * 100) / 100,
    };
  }

  async computeAndUpsertHealth(
    userId: string,
    dateOnly: string,
  ): Promise<Record<string, unknown>> {
    const inputs = await this.collectDailyInputs(userId, dateOnly);

    const healthInput: HealthComputationInput = {
      emotion: inputs.emotion,
      journalStressLevel: inputs.journalStressLevel,
      nutritionCalories: inputs.nutritionCalories,
      sleepQualityScore: inputs.sleepQualityScore,
      typingStressScore: inputs.typingStressScore,
    };

    const computation = await this.aiClient.computeHealthScore(
      healthInput,
      userId,
    );
    const insight = mapHealthStatusLabel(computation.healthScore).suggestion;

    const { data, error } = await this.supabase
      .from("daily_health_snapshots")
      .upsert(
        {
          user_id: userId,
          snapshot_date: dateOnly,
          mood_score: computation.breakdown.mood,
          nutrition_score: computation.breakdown.nutrition,
          sleep_score: computation.breakdown.sleep,
          stress_score: computation.breakdown.stress,
          overall_health_score: computation.healthScore,
          insight_summary: insight,
        },
        {
          onConflict: "user_id,snapshot_date",
        },
      )
      .select(
        "id, snapshot_date, mood_score, nutrition_score, sleep_score, stress_score, overall_health_score, insight_summary",
      )
      .single();

    if (error || !data) {
      throw new AppError(
        `Failed to compute health snapshot: ${error?.message ?? "unknown"}`,
        500,
      );
    }

    return data as Record<string, unknown>;
  }
}

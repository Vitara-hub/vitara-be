import { AppError } from "../../core/errors/AppError.js";
import { Logger } from "../../core/logger/Logger.js";
import type { Env } from "../config/env.js";

export interface JournalPrediction {
  emotion: string;
  stressLevel: number;
  topics: string[];
}

export interface FoodPrediction {
  foods: string[];
  estimatedCalories: number;
}

export interface SleepPredictionInput {
  durationHours: number;
  bedtime: string;
  wakeTime: string;
  interruptions: number;
}

export interface SleepPrediction {
  qualityScore: number;
}

export interface TypingPredictionInput {
  wpm: number;
  backspaceRate: number;
  interKeyTimings: number[];
}

export interface TypingPrediction {
  stressScore: number;
}

export interface HealthComputationInput {
  emotion?: string | null;
  journalStressLevel?: number | null;
  nutritionCalories?: number | null;
  sleepQualityScore?: number | null;
  typingStressScore?: number | null;
}

export interface HealthComputationResult {
  healthScore: number;
  breakdown: {
    mood: number | null;
    nutrition: number | null;
    stress: number | null;
    sleep: number | null;
  };
}

export interface CompanionChatResult {
  response: string;
  recommendations: string[];
}

const DEFAULT_JOURNAL_PREDICTION: JournalPrediction = {
  emotion: "neutral",
  stressLevel: 0.5,
  topics: ["general"],
};

function toNumberOrNaN(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

function normalizeTopics(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (text.length === 0) return [];

    return text
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function parseJournalPayload(
  payload: Record<string, unknown>,
): JournalPrediction {
  const emotionRaw =
    typeof payload.emotion === "string"
      ? payload.emotion.trim()
      : typeof payload.sentiment === "string"
        ? payload.sentiment.trim()
        : "";

  const stressLevelCandidates = [
    toNumberOrNaN(payload.stress_level),
    toNumberOrNaN(payload.stressLevel),
    toNumberOrNaN(payload.stress),
  ];
  const stressLevelRaw = stressLevelCandidates.find(Number.isFinite);
  const stressLevelValue =
    typeof stressLevelRaw === "number"
      ? stressLevelRaw
      : DEFAULT_JOURNAL_PREDICTION.stressLevel;

  const topicsRaw =
    [
      normalizeTopics(payload.topics),
      normalizeTopics(payload.topic),
      normalizeTopics(payload.keywords),
    ].find((topics) => topics.length > 0) ?? [];

  return {
    emotion:
      emotionRaw.length > 0 ? emotionRaw : DEFAULT_JOURNAL_PREDICTION.emotion,
    stressLevel: roundTo2(clamp(stressLevelValue, 0, 1)),
    topics:
      topicsRaw.length > 0 ? topicsRaw : DEFAULT_JOURNAL_PREDICTION.topics,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeScoreToPercent(value: number): number {
  if (!Number.isFinite(value)) return NaN;
  // Accept both 0..1 and 0..100 scales from AI service.
  return value <= 1 ? value * 100 : value;
}

function toRoundedScoreOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(Math.round(value), 0, 100)
    : null;
}

function parseSseDataEvents(raw: string): Array<Record<string, unknown>> {
  return raw
    .split(/\n\n+/)
    .map((eventBlock) => {
      const dataLines = eventBlock
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length === 0) return null;

      try {
        return JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((event): event is Record<string, unknown> => event !== null);
}

export class AiGatewayClient {
  private readonly logger = new Logger("AiGatewayClient");

  constructor(private readonly env: Env) {}

  private async fetchWithTimeout(
    input: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.env.AI_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      return response;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AppError("AI service request timed out", 504);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async predictJournal(
    text: string,
    userId: string,
  ): Promise<JournalPrediction> {
    const endpoint = `${this.env.AI_SERVICE_BASE_URL}/predict/journal`;

    try {
      const response = await this.fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, user_id: userId }),
      });

      if (!response.ok) {
        const fallback = DEFAULT_JOURNAL_PREDICTION;
        this.logger.warn(
          "Journal AI returned non-OK response. Falling back to mock.",
          {
            status: response.status,
          },
        );
        return fallback;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      return parseJournalPayload(payload);
    } catch (err) {
      this.logger.warn(
        "Journal AI request failed. Falling back to mock response.",
        {
          error: err instanceof Error ? err.message : "unknown",
        },
      );

      return DEFAULT_JOURNAL_PREDICTION;
    }
  }

  async predictFood(
    imageBuffer: Uint8Array,
    filename: string,
    mimeType: string,
    userId: string,
  ): Promise<FoodPrediction> {
    const endpoint = `${this.env.AI_SERVICE_BASE_URL}/predict/food`;
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append("image", blob, filename);
    formData.append("user_id", userId);

    const response = await this.fetchWithTimeout(endpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new AppError("Food AI service is unavailable", 502);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const foodsRaw = Array.isArray(payload.foods)
      ? payload.foods.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
      : [];

    const estimatedCaloriesRaw =
      typeof payload.estimated_calories === "number"
        ? payload.estimated_calories
        : typeof payload.estimatedCalories === "number"
          ? payload.estimatedCalories
          : NaN;

    if (!Number.isFinite(estimatedCaloriesRaw)) {
      throw new AppError("Food AI response is invalid", 502);
    }

    return {
      foods: foodsRaw.length > 0 ? foodsRaw : ["unknown"],
      estimatedCalories: Math.max(0, Math.round(estimatedCaloriesRaw)),
    };
  }

  async predictSleep(
    input: SleepPredictionInput,
    userId: string,
  ): Promise<SleepPrediction> {
    const endpoint = `${this.env.AI_SERVICE_BASE_URL}/predict/sleep`;
    const response = await this.fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        duration_hours: input.durationHours,
        bedtime: input.bedtime,
        wake_time: input.wakeTime,
        interruptions: input.interruptions,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      throw new AppError("Sleep AI service is unavailable", 502);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const qualityScoreRaw =
      typeof payload.quality_score === "number" ? payload.quality_score : NaN;

    if (!Number.isFinite(qualityScoreRaw)) {
      throw new AppError("Sleep AI response is invalid", 502);
    }

    return {
      qualityScore: clamp(
        Math.round(normalizeScoreToPercent(qualityScoreRaw)),
        0,
        100,
      ),
    };
  }

  async predictTyping(
    input: TypingPredictionInput,
    userId: string,
  ): Promise<TypingPrediction> {
    const endpoint = `${this.env.AI_SERVICE_BASE_URL}/predict/typing`;
    const response = await this.fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        wpm: input.wpm,
        backspace_rate: input.backspaceRate,
        inter_key_timings: input.interKeyTimings,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      throw new AppError("Typing AI service is unavailable", 502);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const stressScoreRaw =
      typeof payload.stress_score === "number" ? payload.stress_score : NaN;

    if (!Number.isFinite(stressScoreRaw)) {
      throw new AppError("Typing AI response is invalid", 502);
    }

    return {
      stressScore: roundTo2(clamp(stressScoreRaw, 0, 1)),
    };
  }

  async computeHealthScore(
    input: HealthComputationInput,
    userId: string,
  ): Promise<HealthComputationResult> {
    const endpoint = `${this.env.AI_SERVICE_BASE_URL}/health/score`;
    const nlpResult =
      typeof input.emotion === "string" &&
      input.emotion.length > 0 &&
      typeof input.journalStressLevel === "number" &&
      Number.isFinite(input.journalStressLevel)
        ? {
            emotion: input.emotion,
            stress_level: input.journalStressLevel,
          }
        : null;
    const foodResult =
      typeof input.nutritionCalories === "number" &&
      Number.isFinite(input.nutritionCalories)
        ? {
            estimated_calories: input.nutritionCalories,
          }
        : null;
    const sleepResult =
      typeof input.sleepQualityScore === "number" &&
      Number.isFinite(input.sleepQualityScore)
        ? {
            quality_score: input.sleepQualityScore,
          }
        : null;
    const typingResult =
      typeof input.typingStressScore === "number" &&
      Number.isFinite(input.typingStressScore)
        ? {
            stress_score: input.typingStressScore,
          }
        : null;

    const response = await this.fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        ...(nlpResult ? { nlp_result: nlpResult } : {}),
        ...(foodResult ? { food_result: foodResult } : {}),
        ...(sleepResult ? { sleep_result: sleepResult } : {}),
        ...(typingResult ? { typing_result: typingResult } : {}),
      }),
    });

    if (!response.ok) {
      throw new AppError("Health AI service is unavailable", 502);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const breakdown =
      payload.breakdown &&
      typeof payload.breakdown === "object" &&
      !Array.isArray(payload.breakdown)
        ? (payload.breakdown as Record<string, unknown>)
        : {};

    const healthScoreRaw =
      typeof payload.health_score === "number" ? payload.health_score : NaN;
    if (!Number.isFinite(healthScoreRaw)) {
      throw new AppError("Health AI response is invalid", 502);
    }

    return {
      healthScore: clamp(Math.round(healthScoreRaw), 0, 100),
      breakdown: {
        mood: toRoundedScoreOrNull(breakdown.mood),
        nutrition: toRoundedScoreOrNull(breakdown.nutrition),
        stress: toRoundedScoreOrNull(breakdown.stress),
        sleep: toRoundedScoreOrNull(breakdown.sleep),
      },
    };
  }

  async chatCompanion(
    message: string,
    userId: string,
  ): Promise<CompanionChatResult> {
    const endpoint = `${this.env.AI_SERVICE_BASE_URL}/companion/chat`;

    const response = await this.fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        user_id: userId,
        message,
      }),
    });

    if (!response.ok) {
      throw new AppError("Companion AI service is unavailable", 502);
    }

    const raw = await response.text();
    const events = parseSseDataEvents(raw);
    const finalEvent = events.find(
      (event) => typeof event.full_response === "string",
    );
    const deltaText = events
      .map((event) => (typeof event.token === "string" ? event.token : ""))
      .join("");

    const fullResponse =
      finalEvent && typeof finalEvent.full_response === "string"
        ? finalEvent.full_response
        : deltaText;

    const recommendations =
      finalEvent && Array.isArray(finalEvent.recommendations)
        ? finalEvent.recommendations.filter(
            (item): item is string =>
              typeof item === "string" && item.length > 0,
          )
        : [];

    if (fullResponse.length === 0) {
      throw new AppError("Companion AI response is invalid", 502);
    }

    return {
      response: fullResponse,
      recommendations,
    };
  }

  async chatCompanionStream(
    message: string,
    userId: string,
  ): Promise<Response> {
    const endpoint = `${this.env.AI_SERVICE_BASE_URL}/companion/chat`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ user_id: userId, message }),
    });

    if (!response.ok) {
      throw new AppError("Companion AI service is unavailable", 502);
    }

    return response;
  }
}

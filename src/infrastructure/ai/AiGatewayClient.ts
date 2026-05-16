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
  sleepDebtHours: number;
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
  emotion: string;
  journalStressLevel: number;
  nutritionCalories: number;
  sleepQualityScore: number;
  typingStressScore: number;
}

export interface HealthComputationResult {
  healthScore: number;
  breakdown: {
    mood: number;
    nutrition: number;
    stress: number;
    sleep: number;
  };
}

const DEFAULT_JOURNAL_PREDICTION: JournalPrediction = {
  emotion: "neutral",
  stressLevel: 0.5,
  topics: ["general"],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((acc, curr) => acc + curr, 0) / values.length;
  const variance =
    values.reduce((acc, curr) => acc + (curr - mean) * (curr - mean), 0) /
    values.length;
  return Math.sqrt(variance);
}

function emotionToMoodScore(emotion: string): number {
  const normalized = emotion.toLowerCase();
  const map: Record<string, number> = {
    happy: 88,
    calm: 82,
    neutral: 72,
    anxious: 48,
    stressed: 42,
    sad: 40,
    angry: 35,
  };

  return map[normalized] ?? 70;
}

function caloriesToNutritionScore(calories: number): number {
  // MVP heuristic: makan utama ideal di sekitar 500-700 kkal.
  const target = 600;
  const tolerance = 500;
  const delta = Math.abs(calories - target);
  const normalized = clamp(1 - delta / tolerance, 0, 1);
  return Math.round(45 + normalized * 55);
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

  async predictJournal(text: string): Promise<JournalPrediction> {
    const endpoint = `${this.env.AI_SERVICE_BASE_URL}/predict/journal`;

    try {
      const response = await this.fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const fallback = DEFAULT_JOURNAL_PREDICTION;
        this.logger.warn("Journal AI returned non-OK response. Falling back to mock.", {
          status: response.status,
        });
        return fallback;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const emotion =
        typeof payload.emotion === "string" && payload.emotion.length > 0
          ? payload.emotion
          : DEFAULT_JOURNAL_PREDICTION.emotion;

      const stressLevelRaw =
        typeof payload.stress_level === "number"
          ? payload.stress_level
          : DEFAULT_JOURNAL_PREDICTION.stressLevel;

      const topicsRaw = Array.isArray(payload.topics)
        ? payload.topics.filter(
            (item): item is string => typeof item === "string" && item.length > 0,
          )
        : DEFAULT_JOURNAL_PREDICTION.topics;

      return {
        emotion,
        stressLevel: roundTo2(clamp(stressLevelRaw, 0, 1)),
        topics: topicsRaw.length > 0 ? topicsRaw : DEFAULT_JOURNAL_PREDICTION.topics,
      };
    } catch (err) {
      this.logger.warn("Journal AI request failed. Falling back to mock response.", {
        error: err instanceof Error ? err.message : "unknown",
      });

      return DEFAULT_JOURNAL_PREDICTION;
    }
  }

  async predictFood(
    imageBuffer: Uint8Array,
    filename: string,
    mimeType: string,
  ): Promise<FoodPrediction> {
    const endpoint = `${this.env.AI_SERVICE_BASE_URL}/predict/food`;
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append("image", blob, filename);

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

  predictSleep(input: SleepPredictionInput): SleepPrediction {
    // Mock deterministic scoring sementara endpoint AI sleep belum tersedia.
    const base = 70;
    const durationBoost = clamp((input.durationHours - 7) * 8, -20, 15);
    const interruptionsPenalty = clamp(input.interruptions * 8, 0, 30);
    const debtPenalty = clamp(input.sleepDebtHours * 10, 0, 30);

    const qualityScore = clamp(
      Math.round(base + durationBoost - interruptionsPenalty - debtPenalty),
      0,
      100,
    );

    return { qualityScore };
  }

  predictTyping(input: TypingPredictionInput): TypingPrediction {
    // Mock deterministic scoring sementara endpoint AI typing belum tersedia.
    const wpmRisk = clamp((55 - input.wpm) / 55, 0, 1);
    const backspaceRisk = clamp(input.backspaceRate, 0, 1);
    const interKeyStdDev = calculateStdDev(input.interKeyTimings);
    const rhythmRisk = clamp(interKeyStdDev / 300, 0, 1);

    const stressScore = clamp(
      0.2 + wpmRisk * 0.25 + backspaceRisk * 0.4 + rhythmRisk * 0.25,
      0,
      1,
    );

    return {
      stressScore: roundTo2(stressScore),
    };
  }

  computeHealthScore(input: HealthComputationInput): HealthComputationResult {
    const mood = emotionToMoodScore(input.emotion);
    const nutrition = caloriesToNutritionScore(input.nutritionCalories);

    const stressBlend = clamp(
      (input.journalStressLevel + input.typingStressScore) / 2,
      0,
      1,
    );
    const stress = clamp(Math.round((1 - stressBlend) * 100), 0, 100);
    const sleep = clamp(Math.round(input.sleepQualityScore), 0, 100);

    const healthScore = Math.round((mood + nutrition + stress + sleep) / 4);

    return {
      healthScore,
      breakdown: {
        mood,
        nutrition,
        stress,
        sleep,
      },
    };
  }
}

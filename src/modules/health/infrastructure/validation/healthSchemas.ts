import { z } from "zod";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export const healthDailyQuerySchema = z.object({
  from: z.string().regex(dateOnlyRegex).optional(),
  to: z.string().regex(dateOnlyRegex).optional(),
});

export const activitySummaryQuerySchema = z.object({
  period: z.enum(["7d", "30d"]).default("7d"),
});

export const activityRecentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});

import { z } from "zod";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeOnlyRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const sleepAnalyzeSchema = z.object({
  sleepTime: z.string().regex(timeOnlyRegex),
  wakeTime: z.string().regex(timeOnlyRegex),
  interruptions: z.number().int().min(0).max(20).default(0),
  notes: z.string().max(1000).optional(),
});

export const sleepListQuerySchema = z.object({
  date: z.string().regex(dateOnlyRegex).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});

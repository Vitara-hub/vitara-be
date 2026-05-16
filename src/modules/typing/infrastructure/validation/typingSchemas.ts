import { z } from "zod";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export const typingAnalyzeSchema = z.object({
  wpm: z.number().min(0).max(300),
  duration: z.number().int().positive().max(7200),
  textContent: z.string().min(1).max(10000),
  backspaceRate: z.number().min(0).max(1),
  interKeyTimings: z.array(z.number().min(0).max(10000)).max(2000),
});

export const typingListQuerySchema = z.object({
  date: z.string().regex(dateOnlyRegex).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});

export const journalAnalyzeSchema = z.object({
  text: z.string().min(10).max(5000),
});

export const journalListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});

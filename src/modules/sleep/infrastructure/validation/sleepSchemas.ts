import { z } from "zod";

export const createSleepSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  quality: z.number().int().min(1).max(5),
  notes: z.string().optional(),
});

export type CreateSleepInput = z.infer<typeof createSleepSchema>;

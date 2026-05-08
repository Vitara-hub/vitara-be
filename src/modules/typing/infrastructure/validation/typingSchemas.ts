import { z } from "zod";

export const createTypingSessionSchema = z.object({
  wpm: z.number().nonnegative(),
  accuracy: z.number().min(0).max(100),
  duration: z.number().positive(),
  textContent: z.string().min(1),
});

export type CreateTypingSessionInput = z.infer<typeof createTypingSessionSchema>;

import { z } from "zod";

export const sendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

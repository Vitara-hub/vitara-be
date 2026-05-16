import { z } from "zod";

export const updateProfileSchema = z
  .object({
    username: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/).optional(),
    fullName: z.string().min(1).max(100).optional(),
    timezone: z.string().min(1).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const requestDeleteSchema = z.object({
  requestDelete: z.literal(true),
});

import { z } from "zod";

export const signupSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/).optional(),
  fullName: z.string().min(1).max(100).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const googleCallbackSchema = z.union([
  z.object({
    code: z.string().min(1),
  }),
  z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
  }),
]);

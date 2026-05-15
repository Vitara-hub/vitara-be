import { z } from "zod";

export const signupSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/),
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

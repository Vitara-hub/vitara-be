import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AI_SERVICE_BASE_URL: z.string().url().default("http://localhost:8000"),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  SUPABASE_FOOD_BUCKET: z.string().min(1).default("food-images"),
  GOOGLE_OAUTH_REDIRECT_URL: z.string().url().optional(),
  DATA_ENCRYPTION_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
}

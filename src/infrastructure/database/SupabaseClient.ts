import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../config/env.js";
import { Logger } from "../../core/logger/Logger.js";

const logger = new Logger("SupabaseClient");

let client: SupabaseClient | null = null;

/**
 * Returns the admin Supabase client (uses the service-role key).
 * Lazily initialised — safe to call multiple times.
 */
export function getSupabaseAdmin(env: Env): SupabaseClient {
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    logger.info("Supabase admin client initialised");
  }
  return client;
}

/**
 * Creates a *per-request* Supabase client scoped to the user's JWT.
 * Use this inside authenticated route handlers so RLS applies.
 */
export function getSupabaseClient(env: Env, accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

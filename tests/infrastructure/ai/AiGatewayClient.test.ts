import { afterEach, describe, expect, mock, test } from "bun:test";
import { AiGatewayClient } from "../../../src/infrastructure/ai/AiGatewayClient.js";
import type { Env } from "../../../src/infrastructure/config/env.js";

const BASE_ENV: Env = {
  NODE_ENV: "test",
  PORT: 3000,
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  SUPABASE_FOOD_BUCKET: "food-images",
  AI_SERVICE_BASE_URL: "https://example-ai.local",
  AI_REQUEST_TIMEOUT_MS: 2000,
  GOOGLE_OAUTH_REDIRECT_URL: "http://localhost:3000/callback",
};

const originalFetch = globalThis.fetch;

function mockFetch(
  impl: (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => Promise<Response>,
): void {
  globalThis.fetch = mock(impl) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("AiGatewayClient.predictJournal", () => {
  test("should parse topic fallback fields and numeric stress strings", async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            emotion: "happy",
            stress_level: "0.33",
            topic: "kebahagiaan",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const client = new AiGatewayClient(BASE_ENV);
    const result = await client.predictJournal("bahagia banget hari ini", "user-1");

    expect(result.emotion).toBe("happy");
    expect(result.stressLevel).toBe(0.33);
    expect(result.topics).toEqual(["kebahagiaan"]);
  });

  test("should parse comma-separated topics string", async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            emotion: "happy",
            stress_level: 0.2,
            topics: "bahagia, syukur",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const client = new AiGatewayClient(BASE_ENV);
    const result = await client.predictJournal("hari ini bersyukur", "user-1");

    expect(result.topics).toEqual(["bahagia", "syukur"]);
  });
});

import { describe, test, expect, mock } from "bun:test";

// Mock Supabase before any imports that use it
mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mock() },
    from: () => ({
      select: () => ({ eq: () => ({ single: mock(), order: mock() }) }),
      insert: () => ({ select: () => ({ single: mock() }) }),
    }),
  }),
}));

import {
  createContainer,
  type Container,
} from "../../../src/infrastructure/di/Container.js";
import type { Env } from "../../../src/infrastructure/config/env.js";

describe("Container", () => {
  const testEnv: Env = {
    PORT: 3000,
    NODE_ENV: "test",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    AI_SERVICE_BASE_URL: "http://localhost:8000",
    AI_REQUEST_TIMEOUT_MS: 3000,
    SUPABASE_FOOD_BUCKET: "food-images",
  };

  let container: Container;

  test("should create container without throwing", () => {
    expect(() => {
      container = createContainer(testEnv);
    }).not.toThrow();
  });

  test("should expose env configuration", () => {
    container = createContainer(testEnv);
    expect(container.env).toBe(testEnv);
    expect(container.env.PORT).toBe(3000);
    expect(container.env.NODE_ENV).toBe("test");
  });

  test("should expose supabaseAdmin client", () => {
    container = createContainer(testEnv);
    expect(container.supabaseAdmin).toBeDefined();
  });

  test("should wire up FoodController with correct methods", () => {
    container = createContainer(testEnv);
    expect(container.foodController).toBeDefined();
    expect(typeof container.foodController.create).toBe("function");
    expect(typeof container.foodController.list).toBe("function");
  });

  test("should wire up SleepController with correct methods", () => {
    container = createContainer(testEnv);
    expect(container.sleepController).toBeDefined();
    expect(typeof container.sleepController.create).toBe("function");
    expect(typeof container.sleepController.list).toBe("function");
  });

  test("should wire up TypingController with correct methods", () => {
    container = createContainer(testEnv);
    expect(container.typingController).toBeDefined();
    expect(typeof container.typingController.create).toBe("function");
    expect(typeof container.typingController.list).toBe("function");
  });

  test("should wire up ChatController with correct methods", () => {
    container = createContainer(testEnv);
    expect(container.chatController).toBeDefined();
    expect(typeof container.chatController.send).toBe("function");
    expect(typeof container.chatController.history).toBe("function");
  });
});

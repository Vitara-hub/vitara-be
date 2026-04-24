import { describe, test, expect, mock } from "bun:test";
import { SendMessage } from "../../../../src/modules/chat/application/use-cases/SendMessage.js";
import type { IChatRepository } from "../../../../src/modules/chat/domain/repositories/IChatRepository.js";
import type { ChatMessage } from "../../../../src/modules/chat/domain/entities/ChatMessage.js";

describe("SendMessage", () => {
  test("should persist user message and generate assistant reply", async () => {
    const userMsg: ChatMessage = {
      id: "msg-1",
      userId: "user-1",
      sessionId: "session-1",
      role: "user",
      content: "How many calories should I eat?",
      createdAt: new Date("2025-01-01T10:00:00Z"),
    };

    const assistantMsg: ChatMessage = {
      id: "msg-2",
      userId: "user-1",
      sessionId: "session-1",
      role: "assistant",
      content: "Thanks for your message! The health chatbot integration is coming soon.",
      createdAt: new Date("2025-01-01T10:00:01Z"),
    };

    let callCount = 0;
    const mockCreate = mock(() => {
      callCount++;
      return Promise.resolve(callCount === 1 ? userMsg : assistantMsg);
    });

    const mockRepo: IChatRepository = {
      create: mockCreate,
      findBySessionId: mock(() => Promise.resolve([])),
    };

    const useCase = new SendMessage(mockRepo);
    const result = await useCase.execute("user-1", {
      sessionId: "session-1",
      content: "How many calories should I eat?",
    });

    expect(result.userMsg).toEqual(userMsg);
    expect(result.assistantMsg).toEqual(assistantMsg);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  test("first call should be user role, second should be assistant role", async () => {
    const calls: Array<{ role: string }> = [];
    const mockCreate = mock((userId: string, dto: { role: string; sessionId: string; content: string }) => {
      calls.push({ role: dto.role });
      return Promise.resolve({
        id: `msg-${calls.length}`,
        userId,
        sessionId: dto.sessionId,
        role: dto.role as "user" | "assistant",
        content: dto.content,
        createdAt: new Date(),
      });
    });

    const mockRepo: IChatRepository = {
      create: mockCreate,
      findBySessionId: mock(() => Promise.resolve([])),
    };

    const useCase = new SendMessage(mockRepo);
    await useCase.execute("user-1", {
      sessionId: "session-1",
      content: "Hello",
    });

    expect(calls[0].role).toBe("user");
    expect(calls[1].role).toBe("assistant");
  });
});

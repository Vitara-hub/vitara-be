import { describe, test, expect, mock } from "bun:test";
import { GetChatHistory } from "../../../../src/modules/chat/application/use-cases/GetChatHistory.js";
import type { IChatRepository } from "../../../../src/modules/chat/domain/repositories/IChatRepository.js";
import type { ChatMessage } from "../../../../src/modules/chat/domain/entities/ChatMessage.js";

describe("GetChatHistory", () => {
  test("should return messages for a given session", async () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        userId: "user-1",
        sessionId: "session-1",
        role: "user",
        content: "Hello",
        createdAt: new Date("2025-01-01T10:00:00Z"),
      },
      {
        id: "msg-2",
        userId: "user-1",
        sessionId: "session-1",
        role: "assistant",
        content: "Hi there!",
        createdAt: new Date("2025-01-01T10:00:01Z"),
      },
    ];

    const mockFindBySessionId = mock(() => Promise.resolve(messages));

    const mockRepo: IChatRepository = {
      create: mock(() => Promise.resolve(messages[0])),
      findBySessionId: mockFindBySessionId,
    };

    const useCase = new GetChatHistory(mockRepo);
    const result = await useCase.execute("user-1", "session-1");

    expect(result).toEqual(messages);
    expect(mockFindBySessionId).toHaveBeenCalledTimes(1);
    expect(mockFindBySessionId).toHaveBeenCalledWith("user-1", "session-1");
  });

  test("should return empty array for non-existent session", async () => {
    const mockRepo: IChatRepository = {
      create: mock(() => Promise.resolve({} as ChatMessage)),
      findBySessionId: mock(() => Promise.resolve([])),
    };

    const useCase = new GetChatHistory(mockRepo);
    const result = await useCase.execute("user-1", "nonexistent");

    expect(result).toEqual([]);
  });
});

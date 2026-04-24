import { describe, test, expect, mock } from "bun:test";
import { GetTypingSessions } from "../../../../src/modules/typing/application/use-cases/GetTypingSessions.js";
import type { ITypingRepository } from "../../../../src/modules/typing/domain/repositories/ITypingRepository.js";
import type { TypingSession } from "../../../../src/modules/typing/domain/entities/TypingSession.js";

describe("GetTypingSessions", () => {
  test("should return sessions for a given user", async () => {
    const sessions: TypingSession[] = [
      {
        id: "typing-1",
        userId: "user-1",
        wpm: 72,
        accuracy: 96.5,
        duration: 60,
        textContent: "The quick brown fox jumps over the lazy dog.",
        createdAt: new Date("2025-01-01T10:00:00Z"),
      },
    ];

    const mockFindByUserId = mock(() => Promise.resolve(sessions));

    const mockRepo: ITypingRepository = {
      create: mock(() => Promise.resolve(sessions[0])),
      findByUserId: mockFindByUserId,
      findById: mock(() => Promise.resolve(null)),
    };

    const useCase = new GetTypingSessions(mockRepo);
    const result = await useCase.execute("user-1");

    expect(result).toEqual(sessions);
    expect(mockFindByUserId).toHaveBeenCalledTimes(1);
    expect(mockFindByUserId).toHaveBeenCalledWith("user-1");
  });

  test("should return empty array when no sessions exist", async () => {
    const mockRepo: ITypingRepository = {
      create: mock(() => Promise.resolve({} as TypingSession)),
      findByUserId: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
    };

    const useCase = new GetTypingSessions(mockRepo);
    const result = await useCase.execute("user-no-sessions");

    expect(result).toEqual([]);
  });
});

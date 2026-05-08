import { describe, test, expect, mock } from "bun:test";
import { CreateTypingSession } from "../../../../src/modules/typing/application/use-cases/CreateTypingSession.js";
import type { ITypingRepository } from "../../../../src/modules/typing/domain/repositories/ITypingRepository.js";
import type { TypingSession, CreateTypingSessionDTO } from "../../../../src/modules/typing/domain/entities/TypingSession.js";

const makeMockSession = (overrides?: Partial<TypingSession>): TypingSession => ({
  id: "typing-1",
  userId: "user-1",
  wpm: 72,
  accuracy: 96.5,
  duration: 60,
  textContent: "The quick brown fox jumps over the lazy dog.",
  createdAt: new Date("2025-01-01T10:00:00Z"),
  ...overrides,
});

describe("CreateTypingSession", () => {
  test("should delegate to repository and return created session", async () => {
    const expected = makeMockSession();
    const mockCreate = mock(() => Promise.resolve(expected));

    const mockRepo: ITypingRepository = {
      create: mockCreate,
      findByUserId: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
    };

    const useCase = new CreateTypingSession(mockRepo);

    const dto: CreateTypingSessionDTO = {
      wpm: 72,
      accuracy: 96.5,
      duration: 60,
      textContent: "The quick brown fox jumps over the lazy dog.",
    };

    const result = await useCase.execute("user-1", dto);

    expect(result).toEqual(expected);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith("user-1", dto);
  });
});

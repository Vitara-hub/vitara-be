import { describe, test, expect, mock } from "bun:test";
import { CreateSleepEntry } from "../../../../src/modules/sleep/application/use-cases/CreateSleepEntry.js";
import type { ISleepRepository } from "../../../../src/modules/sleep/domain/repositories/ISleepRepository.js";
import type { SleepEntry, CreateSleepEntryDTO } from "../../../../src/modules/sleep/domain/entities/SleepEntry.js";

const makeMockEntry = (overrides?: Partial<SleepEntry>): SleepEntry => ({
  id: "sleep-1",
  userId: "user-1",
  startTime: new Date("2025-01-01T22:00:00Z"),
  endTime: new Date("2025-01-02T06:00:00Z"),
  quality: 4,
  notes: "Slept well",
  createdAt: new Date("2025-01-02T06:01:00Z"),
  ...overrides,
});

describe("CreateSleepEntry", () => {
  test("should delegate to repository and return created entry", async () => {
    const expected = makeMockEntry();
    const mockCreate = mock(() => Promise.resolve(expected));

    const mockRepo: ISleepRepository = {
      create: mockCreate,
      findByUserId: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
    };

    const useCase = new CreateSleepEntry(mockRepo);

    const dto: CreateSleepEntryDTO = {
      startTime: "2025-01-01T22:00:00Z",
      endTime: "2025-01-02T06:00:00Z",
      quality: 4,
      notes: "Slept well",
    };

    const result = await useCase.execute("user-1", dto);

    expect(result).toEqual(expected);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith("user-1", dto);
  });
});

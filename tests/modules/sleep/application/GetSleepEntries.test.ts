import { describe, test, expect, mock } from "bun:test";
import { GetSleepEntries } from "../../../../src/modules/sleep/application/use-cases/GetSleepEntries.js";
import type { ISleepRepository } from "../../../../src/modules/sleep/domain/repositories/ISleepRepository.js";
import type { SleepEntry } from "../../../../src/modules/sleep/domain/entities/SleepEntry.js";

describe("GetSleepEntries", () => {
  test("should return entries for a given user", async () => {
    const entries: SleepEntry[] = [
      {
        id: "sleep-1",
        userId: "user-1",
        startTime: new Date("2025-01-01T22:00:00Z"),
        endTime: new Date("2025-01-02T06:00:00Z"),
        quality: 4,
        notes: null,
        createdAt: new Date("2025-01-02T06:01:00Z"),
      },
    ];

    const mockFindByUserId = mock(() => Promise.resolve(entries));

    const mockRepo: ISleepRepository = {
      create: mock(() => Promise.resolve(entries[0])),
      findByUserId: mockFindByUserId,
      findById: mock(() => Promise.resolve(null)),
    };

    const useCase = new GetSleepEntries(mockRepo);
    const result = await useCase.execute("user-1");

    expect(result).toEqual(entries);
    expect(mockFindByUserId).toHaveBeenCalledTimes(1);
    expect(mockFindByUserId).toHaveBeenCalledWith("user-1");
  });

  test("should return empty array when no entries exist", async () => {
    const mockRepo: ISleepRepository = {
      create: mock(() => Promise.resolve({} as SleepEntry)),
      findByUserId: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
    };

    const useCase = new GetSleepEntries(mockRepo);
    const result = await useCase.execute("user-no-entries");

    expect(result).toEqual([]);
  });
});

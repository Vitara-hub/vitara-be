import { describe, test, expect, mock } from "bun:test";
import { GetFoodEntries } from "../../../../src/modules/food/application/use-cases/GetFoodEntries.js";
import type { IFoodRepository } from "../../../../src/modules/food/domain/repositories/IFoodRepository.js";
import type { FoodEntry } from "../../../../src/modules/food/domain/entities/FoodEntry.js";

describe("GetFoodEntries", () => {
  test("should return entries for a given user", async () => {
    const entries: FoodEntry[] = [
      {
        id: "entry-1",
        userId: "user-1",
        name: "Apple",
        calories: 95,
        protein: 0.5,
        carbs: 25,
        fat: 0.3,
        mealType: "snack",
        consumedAt: new Date("2025-01-01T12:00:00Z"),
        createdAt: new Date("2025-01-01T12:00:00Z"),
      },
    ];

    const mockFindByUserId = mock(() => Promise.resolve(entries));

    const mockRepo: IFoodRepository = {
      create: mock(() => Promise.resolve(entries[0])),
      findByUserId: mockFindByUserId,
      findById: mock(() => Promise.resolve(null)),
    };

    const useCase = new GetFoodEntries(mockRepo);
    const result = await useCase.execute("user-1");

    expect(result).toEqual(entries);
    expect(mockFindByUserId).toHaveBeenCalledTimes(1);
    expect(mockFindByUserId).toHaveBeenCalledWith("user-1");
  });

  test("should return empty array when no entries exist", async () => {
    const mockRepo: IFoodRepository = {
      create: mock(() => Promise.resolve({} as FoodEntry)),
      findByUserId: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
    };

    const useCase = new GetFoodEntries(mockRepo);
    const result = await useCase.execute("user-no-entries");

    expect(result).toEqual([]);
  });
});

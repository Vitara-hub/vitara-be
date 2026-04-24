import { describe, test, expect, mock } from "bun:test";
import { CreateFoodEntry } from "../../../../src/modules/food/application/use-cases/CreateFoodEntry.js";
import type { IFoodRepository } from "../../../../src/modules/food/domain/repositories/IFoodRepository.js";
import type { FoodEntry, CreateFoodEntryDTO } from "../../../../src/modules/food/domain/entities/FoodEntry.js";

const makeMockEntry = (overrides?: Partial<FoodEntry>): FoodEntry => ({
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
  ...overrides,
});

describe("CreateFoodEntry", () => {
  test("should delegate to repository and return created entry", async () => {
    const expected = makeMockEntry();
    const mockCreate = mock(() => Promise.resolve(expected));

    const mockRepo: IFoodRepository = {
      create: mockCreate,
      findByUserId: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
    };

    const useCase = new CreateFoodEntry(mockRepo);

    const dto: CreateFoodEntryDTO = {
      name: "Apple",
      calories: 95,
      protein: 0.5,
      carbs: 25,
      fat: 0.3,
      mealType: "snack",
      consumedAt: "2025-01-01T12:00:00Z",
    };

    const result = await useCase.execute("user-1", dto);

    expect(result).toEqual(expected);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith("user-1", dto);
  });
});

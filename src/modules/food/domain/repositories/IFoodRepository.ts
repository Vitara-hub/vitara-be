import type { FoodEntry, CreateFoodEntryDTO } from "../entities/FoodEntry.js";

export interface IFoodRepository {
  create(userId: string, dto: CreateFoodEntryDTO): Promise<FoodEntry>;
  findByUserId(userId: string): Promise<FoodEntry[]>;
  findById(id: string): Promise<FoodEntry | null>;
}

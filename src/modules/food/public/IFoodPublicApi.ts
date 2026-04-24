import type { FoodEntry } from "../domain/entities/FoodEntry.js";

export interface IFoodPublicApi {
  getFoodEntriesByUserId(userId: string): Promise<FoodEntry[]>;
}

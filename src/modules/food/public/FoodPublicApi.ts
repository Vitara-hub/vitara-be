import type { IFoodPublicApi } from "./IFoodPublicApi.js";
import type { IFoodRepository } from "../domain/repositories/IFoodRepository.js";
import type { FoodEntry } from "../domain/entities/FoodEntry.js";

export class FoodPublicApi implements IFoodPublicApi {
  constructor(private readonly repo: IFoodRepository) {}

  async getFoodEntriesByUserId(userId: string): Promise<FoodEntry[]> {
    return this.repo.findByUserId(userId);
  }
}

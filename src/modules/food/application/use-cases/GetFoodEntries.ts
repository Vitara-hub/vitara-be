import type { IFoodRepository } from "../../domain/repositories/IFoodRepository.js";
import type { FoodEntry } from "../../domain/entities/FoodEntry.js";

export class GetFoodEntries {
  constructor(private readonly repo: IFoodRepository) {}

  async execute(userId: string): Promise<FoodEntry[]> {
    return this.repo.findByUserId(userId);
  }
}

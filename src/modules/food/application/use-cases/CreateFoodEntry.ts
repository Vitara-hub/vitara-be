import type { IFoodRepository } from "../../domain/repositories/IFoodRepository.js";
import type { FoodEntry, CreateFoodEntryDTO } from "../../domain/entities/FoodEntry.js";

export class CreateFoodEntry {
  constructor(private readonly repo: IFoodRepository) {}

  async execute(userId: string, dto: CreateFoodEntryDTO): Promise<FoodEntry> {
    return this.repo.create(userId, dto);
  }
}

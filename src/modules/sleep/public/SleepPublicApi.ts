import type { ISleepPublicApi } from "./ISleepPublicApi.js";
import type { ISleepRepository } from "../domain/repositories/ISleepRepository.js";
import type { SleepEntry } from "../domain/entities/SleepEntry.js";

export class SleepPublicApi implements ISleepPublicApi {
  constructor(private readonly repo: ISleepRepository) {}

  async getSleepEntriesByUserId(userId: string): Promise<SleepEntry[]> {
    return this.repo.findByUserId(userId);
  }
}

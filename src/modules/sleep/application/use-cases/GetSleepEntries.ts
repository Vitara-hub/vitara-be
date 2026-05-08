import type { ISleepRepository } from "../../domain/repositories/ISleepRepository.js";
import type { SleepEntry } from "../../domain/entities/SleepEntry.js";

export class GetSleepEntries {
  constructor(private readonly repo: ISleepRepository) {}

  async execute(userId: string): Promise<SleepEntry[]> {
    return this.repo.findByUserId(userId);
  }
}

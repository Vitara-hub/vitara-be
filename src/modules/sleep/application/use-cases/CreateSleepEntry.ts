import type { ISleepRepository } from "../../domain/repositories/ISleepRepository.js";
import type { SleepEntry, CreateSleepEntryDTO } from "../../domain/entities/SleepEntry.js";

export class CreateSleepEntry {
  constructor(private readonly repo: ISleepRepository) {}

  async execute(userId: string, dto: CreateSleepEntryDTO): Promise<SleepEntry> {
    return this.repo.create(userId, dto);
  }
}

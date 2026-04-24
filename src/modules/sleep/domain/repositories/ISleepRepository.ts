import type { SleepEntry, CreateSleepEntryDTO } from "../entities/SleepEntry.js";

export interface ISleepRepository {
  create(userId: string, dto: CreateSleepEntryDTO): Promise<SleepEntry>;
  findByUserId(userId: string): Promise<SleepEntry[]>;
  findById(id: string): Promise<SleepEntry | null>;
}

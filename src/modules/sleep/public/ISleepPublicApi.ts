import type { SleepEntry } from "../domain/entities/SleepEntry.js";

export interface ISleepPublicApi {
  getSleepEntriesByUserId(userId: string): Promise<SleepEntry[]>;
}

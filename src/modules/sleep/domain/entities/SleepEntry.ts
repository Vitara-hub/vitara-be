export interface SleepEntry {
  id: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  quality: number;
  notes: string | null;
  createdAt: Date;
}

export interface CreateSleepEntryDTO {
  startTime: string;
  endTime: string;
  quality: number;
  notes?: string;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ISleepRepository } from "../../domain/repositories/ISleepRepository.js";
import type { SleepEntry, CreateSleepEntryDTO } from "../../domain/entities/SleepEntry.js";
import { AppError } from "../../../../core/errors/AppError.js";

export class SupabaseSleepRepository implements ISleepRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(userId: string, dto: CreateSleepEntryDTO): Promise<SleepEntry> {
    const { data, error } = await this.supabase
      .from("sleep_entries")
      .insert({
        user_id: userId,
        start_time: dto.startTime,
        end_time: dto.endTime,
        quality: dto.quality,
        notes: dto.notes ?? null,
      })
      .select()
      .single();

    if (error) throw new AppError(`Failed to create sleep entry: ${error.message}`, 500);
    return this.toDomain(data);
  }

  async findByUserId(userId: string): Promise<SleepEntry[]> {
    const { data, error } = await this.supabase
      .from("sleep_entries")
      .select()
      .eq("user_id", userId)
      .order("start_time", { ascending: false });

    if (error) throw new AppError(`Failed to fetch sleep entries: ${error.message}`, 500);
    return (data ?? []).map(this.toDomain);
  }

  async findById(id: string): Promise<SleepEntry | null> {
    const { data, error } = await this.supabase
      .from("sleep_entries")
      .select()
      .eq("id", id)
      .single();

    if (error) return null;
    return this.toDomain(data);
  }

  private toDomain(row: Record<string, unknown>): SleepEntry {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      startTime: new Date(row.start_time as string),
      endTime: new Date(row.end_time as string),
      quality: row.quality as number,
      notes: (row.notes as string) ?? null,
      createdAt: new Date(row.created_at as string),
    };
  }
}

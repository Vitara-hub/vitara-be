import type { SupabaseClient } from "@supabase/supabase-js";
import type { ITypingRepository } from "../../domain/repositories/ITypingRepository.js";
import type { TypingSession, CreateTypingSessionDTO } from "../../domain/entities/TypingSession.js";
import { AppError } from "../../../../core/errors/AppError.js";

export class SupabaseTypingRepository implements ITypingRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(userId: string, dto: CreateTypingSessionDTO): Promise<TypingSession> {
    const { data, error } = await this.supabase
      .from("typing_sessions")
      .insert({
        user_id: userId,
        wpm: dto.wpm,
        accuracy: dto.accuracy,
        duration: dto.duration,
        text_content: dto.textContent,
      })
      .select()
      .single();

    if (error) throw new AppError(`Failed to create typing session: ${error.message}`, 500);
    return this.toDomain(data);
  }

  async findByUserId(userId: string): Promise<TypingSession[]> {
    const { data, error } = await this.supabase
      .from("typing_sessions")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(`Failed to fetch typing sessions: ${error.message}`, 500);
    return (data ?? []).map(this.toDomain);
  }

  async findById(id: string): Promise<TypingSession | null> {
    const { data, error } = await this.supabase
      .from("typing_sessions")
      .select()
      .eq("id", id)
      .single();

    if (error) return null;
    return this.toDomain(data);
  }

  private toDomain(row: Record<string, unknown>): TypingSession {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      wpm: row.wpm as number,
      accuracy: row.accuracy as number,
      duration: row.duration as number,
      textContent: row.text_content as string,
      createdAt: new Date(row.created_at as string),
    };
  }
}

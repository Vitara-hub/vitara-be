import type { SupabaseClient } from "@supabase/supabase-js";
import type { IChatRepository } from "../../domain/repositories/IChatRepository.js";
import type { ChatMessage, SendMessageDTO } from "../../domain/entities/ChatMessage.js";
import { AppError } from "../../../../core/errors/AppError.js";

export class SupabaseChatRepository implements IChatRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(userId: string, dto: SendMessageDTO & { role: "user" | "assistant" }): Promise<ChatMessage> {
    const { data, error } = await this.supabase
      .from("chat_messages")
      .insert({
        user_id: userId,
        session_id: dto.sessionId,
        role: dto.role,
        content: dto.content,
      })
      .select()
      .single();

    if (error) throw new AppError(`Failed to create chat message: ${error.message}`, 500);
    return this.toDomain(data);
  }

  async findBySessionId(userId: string, sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase
      .from("chat_messages")
      .select()
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw new AppError(`Failed to fetch chat history: ${error.message}`, 500);
    return (data ?? []).map(this.toDomain);
  }

  private toDomain(row: Record<string, unknown>): ChatMessage {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      sessionId: row.session_id as string,
      role: row.role as ChatMessage["role"],
      content: row.content as string,
      createdAt: new Date(row.created_at as string),
    };
  }
}

import type { ChatMessage, SendMessageDTO } from "../entities/ChatMessage.js";

export interface IChatRepository {
  create(userId: string, dto: SendMessageDTO & { role: "user" | "assistant" }): Promise<ChatMessage>;
  findBySessionId(userId: string, sessionId: string): Promise<ChatMessage[]>;
}

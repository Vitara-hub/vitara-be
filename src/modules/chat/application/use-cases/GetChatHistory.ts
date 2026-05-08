import type { IChatRepository } from "../../domain/repositories/IChatRepository.js";
import type { ChatMessage } from "../../domain/entities/ChatMessage.js";

export class GetChatHistory {
  constructor(private readonly repo: IChatRepository) {}

  async execute(userId: string, sessionId: string): Promise<ChatMessage[]> {
    return this.repo.findBySessionId(userId, sessionId);
  }
}

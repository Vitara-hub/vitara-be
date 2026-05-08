import type { IChatPublicApi } from "./IChatPublicApi.js";
import type { IChatRepository } from "../domain/repositories/IChatRepository.js";
import type { ChatMessage } from "../domain/entities/ChatMessage.js";

export class ChatPublicApi implements IChatPublicApi {
  constructor(private readonly repo: IChatRepository) {}

  async getChatHistory(userId: string, sessionId: string): Promise<ChatMessage[]> {
    return this.repo.findBySessionId(userId, sessionId);
  }
}

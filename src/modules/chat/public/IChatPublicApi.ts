import type { ChatMessage } from "../domain/entities/ChatMessage.js";

export interface IChatPublicApi {
  getChatHistory(userId: string, sessionId: string): Promise<ChatMessage[]>;
}

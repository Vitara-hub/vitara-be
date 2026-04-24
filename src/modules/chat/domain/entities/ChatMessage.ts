export interface ChatMessage {
  id: string;
  userId: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
}

export type ChatRole = "user" | "assistant";

export interface SendMessageDTO {
  sessionId: string;
  content: string;
}

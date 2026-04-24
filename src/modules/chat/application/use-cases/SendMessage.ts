import type { IChatRepository } from "../../domain/repositories/IChatRepository.js";
import type { ChatMessage, SendMessageDTO } from "../../domain/entities/ChatMessage.js";

export class SendMessage {
  constructor(private readonly repo: IChatRepository) {}

  /**
   * Persists the user message and generates a placeholder assistant reply.
   *
   * TODO: Integrate with an LLM provider (e.g. OpenAI, Gemini) for real
   *       health-chatbot responses.
   */
  async execute(userId: string, dto: SendMessageDTO): Promise<{ userMsg: ChatMessage; assistantMsg: ChatMessage }> {
    const userMsg = await this.repo.create(userId, {
      ...dto,
      role: "user",
    });

    // Placeholder reply — swap this for a real LLM call later
    const assistantMsg = await this.repo.create(userId, {
      sessionId: dto.sessionId,
      content: "Thanks for your message! The health chatbot integration is coming soon.",
      role: "assistant",
    });

    return { userMsg, assistantMsg };
  }
}

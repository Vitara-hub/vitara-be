import type { ITypingRepository } from "../../domain/repositories/ITypingRepository.js";
import type { TypingSession, CreateTypingSessionDTO } from "../../domain/entities/TypingSession.js";

export class CreateTypingSession {
  constructor(private readonly repo: ITypingRepository) {}

  async execute(userId: string, dto: CreateTypingSessionDTO): Promise<TypingSession> {
    return this.repo.create(userId, dto);
  }
}

import type { ITypingRepository } from "../../domain/repositories/ITypingRepository.js";
import type { TypingSession } from "../../domain/entities/TypingSession.js";

export class GetTypingSessions {
  constructor(private readonly repo: ITypingRepository) {}

  async execute(userId: string): Promise<TypingSession[]> {
    return this.repo.findByUserId(userId);
  }
}

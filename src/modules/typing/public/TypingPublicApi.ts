import type { ITypingPublicApi } from "./ITypingPublicApi.js";
import type { ITypingRepository } from "../domain/repositories/ITypingRepository.js";
import type { TypingSession } from "../domain/entities/TypingSession.js";

export class TypingPublicApi implements ITypingPublicApi {
  constructor(private readonly repo: ITypingRepository) {}

  async getTypingSessionsByUserId(userId: string): Promise<TypingSession[]> {
    return this.repo.findByUserId(userId);
  }
}

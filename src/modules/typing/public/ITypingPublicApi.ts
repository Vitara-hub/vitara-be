import type { TypingSession } from "../domain/entities/TypingSession.js";

export interface ITypingPublicApi {
  getTypingSessionsByUserId(userId: string): Promise<TypingSession[]>;
}

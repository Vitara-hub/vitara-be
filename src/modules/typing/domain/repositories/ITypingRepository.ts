import type { TypingSession, CreateTypingSessionDTO } from "../entities/TypingSession.js";

export interface ITypingRepository {
  create(userId: string, dto: CreateTypingSessionDTO): Promise<TypingSession>;
  findByUserId(userId: string): Promise<TypingSession[]>;
  findById(id: string): Promise<TypingSession | null>;
}

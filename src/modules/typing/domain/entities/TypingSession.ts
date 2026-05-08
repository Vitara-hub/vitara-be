export interface TypingSession {
  id: string;
  userId: string;
  wpm: number;
  accuracy: number;
  duration: number;
  textContent: string;
  createdAt: Date;
}

export interface CreateTypingSessionDTO {
  wpm: number;
  accuracy: number;
  duration: number;
  textContent: string;
}

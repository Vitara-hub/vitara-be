import type { Request, Response, NextFunction } from "express";
import type { CreateTypingSession } from "../../application/use-cases/CreateTypingSession.js";
import type { GetTypingSessions } from "../../application/use-cases/GetTypingSessions.js";
import { BadRequestError, UnauthorizedError } from "../../../../core/errors/AppError.js";
import { createTypingSessionSchema } from "../validation/typingSchemas.js";

export class TypingController {
  constructor(
    private readonly createTypingSession: CreateTypingSession,
    private readonly getTypingSessions: GetTypingSessions,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) throw new UnauthorizedError();

      const parsed = createTypingSessionSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);

      const session = await this.createTypingSession.execute(req.userId, parsed.data);
      res.status(201).json({ status: "success", data: session });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) throw new UnauthorizedError();

      const sessions = await this.getTypingSessions.execute(req.userId);
      res.json({ status: "success", data: sessions });
    } catch (err) {
      next(err);
    }
  };
}

import type { Request, Response, NextFunction } from "express";
import type { SendMessage } from "../../application/use-cases/SendMessage.js";
import type { GetChatHistory } from "../../application/use-cases/GetChatHistory.js";
import {
  BadRequestError,
  UnauthorizedError,
} from "../../../../core/errors/AppError.js";
import { sendMessageSchema } from "../validation/chatSchemas.js";

export class ChatController {
  constructor(
    private readonly sendMessage: SendMessage,
    private readonly getChatHistory: GetChatHistory,
  ) {}

  send = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.userId) throw new UnauthorizedError();

      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);

      const result = await this.sendMessage.execute(req.userId, parsed.data);
      res.status(201).json({ status: "success", data: result });
    } catch (err) {
      next(err);
    }
  };

  history = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.userId) throw new UnauthorizedError();

      const sessionId = req.params.sessionId;
      if (!sessionId || Array.isArray(sessionId))
        throw new BadRequestError("sessionId param is required");

      const messages = await this.getChatHistory.execute(req.userId, sessionId);
      res.json({ status: "success", data: messages });
    } catch (err) {
      next(err);
    }
  };
}

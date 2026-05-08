import type { Request, Response, NextFunction } from "express";
import type { CreateSleepEntry } from "../../application/use-cases/CreateSleepEntry.js";
import type { GetSleepEntries } from "../../application/use-cases/GetSleepEntries.js";
import { BadRequestError, UnauthorizedError } from "../../../../core/errors/AppError.js";
import { createSleepSchema } from "../validation/sleepSchemas.js";

export class SleepController {
  constructor(
    private readonly createSleepEntry: CreateSleepEntry,
    private readonly getSleepEntries: GetSleepEntries,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) throw new UnauthorizedError();

      const parsed = createSleepSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);

      const entry = await this.createSleepEntry.execute(req.userId, parsed.data);
      res.status(201).json({ status: "success", data: entry });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) throw new UnauthorizedError();

      const entries = await this.getSleepEntries.execute(req.userId);
      res.json({ status: "success", data: entries });
    } catch (err) {
      next(err);
    }
  };
}

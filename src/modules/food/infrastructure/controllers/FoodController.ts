import type { Request, Response, NextFunction } from "express";
import type { CreateFoodEntry } from "../../application/use-cases/CreateFoodEntry.js";
import type { GetFoodEntries } from "../../application/use-cases/GetFoodEntries.js";
import {
  BadRequestError,
  UnauthorizedError,
} from "../../../../core/errors/AppError.js";
import { createFoodSchema } from "../validation/foodSchemas.js";

export class FoodController {
  constructor(
    private readonly createFoodEntry: CreateFoodEntry,
    private readonly getFoodEntries: GetFoodEntries,
  ) {}

  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.userId) throw new UnauthorizedError();

      const parsed = createFoodSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);

      const entry = await this.createFoodEntry.execute(req.userId, parsed.data);
      res.status(201).json({ status: "success", data: entry });
    } catch (err) {
      next(err);
    }
  };

  list = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.userId) throw new UnauthorizedError();

      const entries = await this.getFoodEntries.execute(req.userId);
      res.json({ status: "success", data: entries });
    } catch (err) {
      next(err);
    }
  };
}

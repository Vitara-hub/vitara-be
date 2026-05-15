import { z } from "zod";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createFoodSchema = z.object({
  name: z.string().min(1).max(160),
  calories: z.number().int().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  consumedAt: z.string().datetime(),
});

export const foodListQuerySchema = z.object({
  date: z.string().regex(dateOnlyRegex).optional(),
  mealType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});

export type CreateFoodInput = z.infer<typeof createFoodSchema>;

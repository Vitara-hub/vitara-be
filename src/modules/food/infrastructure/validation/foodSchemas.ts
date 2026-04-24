import { z } from "zod";

export const createFoodSchema = z.object({
  name: z.string().min(1),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  consumedAt: z.string().datetime(),
});

export type CreateFoodInput = z.infer<typeof createFoodSchema>;

export interface FoodEntry {
  id: string;
  userId: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: MealType;
  consumedAt: Date;
  createdAt: Date;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface CreateFoodEntryDTO {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: MealType;
  consumedAt: string;
}

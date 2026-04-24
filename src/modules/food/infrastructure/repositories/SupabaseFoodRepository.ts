import type { SupabaseClient } from "@supabase/supabase-js";
import type { IFoodRepository } from "../../domain/repositories/IFoodRepository.js";
import type { FoodEntry, CreateFoodEntryDTO } from "../../domain/entities/FoodEntry.js";
import { AppError } from "../../../../core/errors/AppError.js";

export class SupabaseFoodRepository implements IFoodRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(userId: string, dto: CreateFoodEntryDTO): Promise<FoodEntry> {
    const { data, error } = await this.supabase
      .from("food_entries")
      .insert({
        user_id: userId,
        name: dto.name,
        calories: dto.calories,
        protein: dto.protein,
        carbs: dto.carbs,
        fat: dto.fat,
        meal_type: dto.mealType,
        consumed_at: dto.consumedAt,
      })
      .select()
      .single();

    if (error) throw new AppError(`Failed to create food entry: ${error.message}`, 500);
    return this.toDomain(data);
  }

  async findByUserId(userId: string): Promise<FoodEntry[]> {
    const { data, error } = await this.supabase
      .from("food_entries")
      .select()
      .eq("user_id", userId)
      .order("consumed_at", { ascending: false });

    if (error) throw new AppError(`Failed to fetch food entries: ${error.message}`, 500);
    return (data ?? []).map(this.toDomain);
  }

  async findById(id: string): Promise<FoodEntry | null> {
    const { data, error } = await this.supabase
      .from("food_entries")
      .select()
      .eq("id", id)
      .single();

    if (error) return null;
    return this.toDomain(data);
  }

  private toDomain(row: Record<string, unknown>): FoodEntry {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      calories: row.calories as number,
      protein: row.protein as number,
      carbs: row.carbs as number,
      fat: row.fat as number,
      mealType: row.meal_type as FoodEntry["mealType"],
      consumedAt: new Date(row.consumed_at as string),
      createdAt: new Date(row.created_at as string),
    };
  }
}

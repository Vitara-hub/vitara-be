import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import { AppError, BadRequestError } from "../../../../core/errors/AppError.js";
import { Logger } from "../../../../core/logger/Logger.js";
import type { AiGatewayClient } from "../../../../infrastructure/ai/AiGatewayClient.js";
import type { Env } from "../../../../infrastructure/config/env.js";
import { getDayBoundaries } from "../../../shared/infrastructure/utils/dateUtils.js";
import {
  parseValidationError,
  requireUserId,
} from "../../../shared/infrastructure/utils/requestUtils.js";
import {
  createFoodSchema,
  foodListQuerySchema,
} from "../validation/foodSchemas.js";

function extractOriginalFilename(
  originalName: string,
  mimeType: string,
): string {
  const safeName = originalName.trim().replace(/[^a-zA-Z0-9_.-]/g, "_");
  if (safeName.length > 0) return safeName;

  if (mimeType === "image/png") return "upload.png";
  return "upload.jpg";
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  return "jpg";
}

export class FoodController {
  private readonly logger = new Logger("FoodController");

  constructor(
    private readonly env: Env,
    private readonly supabase: SupabaseClient,
    private readonly aiClient: AiGatewayClient,
  ) {}

  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = createFoodSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      const { data, error } = await this.supabase
        .from("food_entries")
        .insert({
          user_id: userId,
          name: parsed.data.name,
          calories: parsed.data.calories,
          protein: parsed.data.protein,
          carbs: parsed.data.carbs,
          fat: parsed.data.fat,
          consumed_at: parsed.data.consumedAt,
          source: "manual",
        })
        .select(
          "id, name, calories, protein, carbs, fat, source, consumed_at, created_at, image_url, food_image_url",
        )
        .single();

      if (error || !data) {
        throw new AppError(
          `Failed to create food entry: ${error?.message ?? "unknown"}`,
          500,
        );
      }

      res.status(201).json({
        status: "success",
        data: {
          id: String(data.id),
          name: String(data.name),
          calories: Number(data.calories),
          protein: Number(data.protein),
          carbs: Number(data.carbs),
          fat: Number(data.fat),
          source: String(data.source),
          consumedAt: String(data.consumed_at),
          createdAt: String(data.created_at),
          imageUrl: typeof data.image_url === "string" ? data.image_url : null,
          imagePath:
            typeof data.food_image_url === "string"
              ? data.food_image_url
              : null,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  analyzeImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    let uploadedObjectPath: string | null = null;

    try {
      const userId = requireUserId(req);
      if (!req.file) {
        throw new BadRequestError("image file is required");
      }

      const mimeType = req.file.mimetype;
      const filename = extractOriginalFilename(req.file.originalname, mimeType);
      const extension = extensionFromMimeType(mimeType);
      const objectPath = `${userId}/${Date.now()}-${randomUUID()}.${extension}`;
      uploadedObjectPath = objectPath;

      const { error: uploadError } = await this.supabase.storage
        .from(this.env.SUPABASE_FOOD_BUCKET)
        .upload(objectPath, req.file.buffer, {
          contentType: mimeType,
          upsert: false,
          cacheControl: "3600",
        });

      if (uploadError) {
        throw new AppError(
          `Failed to upload image: ${uploadError.message}`,
          500,
        );
      }

      const { data: signedData, error: signedError } =
        await this.supabase.storage
          .from(this.env.SUPABASE_FOOD_BUCKET)
          .createSignedUrl(objectPath, 60 * 60 * 24 * 7);

      if (signedError) {
        throw new AppError(
          `Failed to create signed image URL: ${signedError.message}`,
          500,
        );
      }

      const aiResult = await this.aiClient.predictFood(
        req.file.buffer,
        filename,
        mimeType,
        userId,
      );

      const { data, error } = await this.supabase
        .from("food_entries")
        .insert({
          user_id: userId,
          name: aiResult.foods[0] ?? "unknown",
          calories: aiResult.estimatedCalories,
          protein: 0,
          carbs: 0,
          fat: 0,
          consumed_at: new Date().toISOString(),
          source: "ai",
          food_image_url: objectPath,
          image_url: signedData.signedUrl,
          ai_food_label: aiResult.foods.join(", "),
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new AppError(
          `Failed to save AI food entry: ${error?.message ?? "unknown"}`,
          500,
        );
      }

      res.json({
        status: "success",
        data: {
          entryId: String(data.id),
          foods: aiResult.foods,
          estimatedCalories: aiResult.estimatedCalories,
          imageUrl: signedData.signedUrl,
        },
      });
    } catch (err) {
      if (uploadedObjectPath) {
        const { error: cleanupError } = await this.supabase.storage
          .from(this.env.SUPABASE_FOOD_BUCKET)
          .remove([uploadedObjectPath]);

        if (cleanupError) {
          this.logger.warn(
            "Failed to cleanup uploaded food image after error",
            {
              path: uploadedObjectPath,
              error: cleanupError.message,
            },
          );
        }
      }

      next(err);
    }
  };

  list = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const parsed = foodListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parseValidationError(parsed.error));
      }

      let query = this.supabase
        .from("food_entries")
        .select(
          "id, name, calories, protein, carbs, fat, source, consumed_at, created_at, image_url, food_image_url, ai_food_label",
        )
        .eq("user_id", userId)
        .order("consumed_at", { ascending: false })
        .limit(parsed.data.limit + 1);

      if (parsed.data.cursor) {
        query = query.lt("consumed_at", parsed.data.cursor);
      }

      if (parsed.data.date) {
        const boundaries = getDayBoundaries(parsed.data.date);
        query = query
          .gte("consumed_at", boundaries.startIso)
          .lte("consumed_at", boundaries.endIso);
      }

      const { data, error } = await query;
      if (error) {
        throw new AppError(
          `Failed to fetch food entries: ${error.message}`,
          500,
        );
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const hasMore = rows.length > parsed.data.limit;
      const items = hasMore ? rows.slice(0, parsed.data.limit) : rows;
      const nextCursor = hasMore
        ? String(items[items.length - 1]?.consumed_at ?? "") || null
        : null;

      res.json({
        status: "success",
        data: {
          items: items.map((row) => ({
            id: String(row.id),
            name: String(row.name),
            calories: Number(row.calories),
            protein: Number(row.protein),
            carbs: Number(row.carbs),
            fat: Number(row.fat),
            source: String(row.source),
            consumedAt: String(row.consumed_at),
            createdAt: String(row.created_at),
            imageUrl: typeof row.image_url === "string" ? row.image_url : null,
            imagePath:
              typeof row.food_image_url === "string"
                ? row.food_image_url
                : null,
            aiFoodLabel:
              typeof row.ai_food_label === "string" ? row.ai_food_label : null,
          })),
          nextCursor,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

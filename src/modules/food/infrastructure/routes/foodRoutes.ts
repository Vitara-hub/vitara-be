import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import multer from "multer";
import { AppError, BadRequestError } from "../../../../core/errors/AppError.js";
import { authMiddleware } from "../../../../infrastructure/http/middleware/authMiddleware.js";
import { requireUserId } from "../../../shared/infrastructure/utils/requestUtils.js";
import type { FoodController } from "../controllers/FoodController.js";

const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_UPLOAD_LIMIT_MAX_REQUESTS = 3;
const IMAGE_UPLOAD_LIMIT_WINDOW_MS = 60_000;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
]);
const uploadLimiterStore = new Map<string, { count: number; windowStart: number }>();

function createImageUploadRateLimitMiddleware() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const userId = requireUserId(req);
      const now = Date.now();
      const current = uploadLimiterStore.get(userId);

      if (!current || now - current.windowStart >= IMAGE_UPLOAD_LIMIT_WINDOW_MS) {
        uploadLimiterStore.set(userId, { count: 1, windowStart: now });
        next();
        return;
      }

      if (current.count >= IMAGE_UPLOAD_LIMIT_MAX_REQUESTS) {
        next(new AppError("Too many image uploads. Max 3 requests per minute.", 429));
        return;
      }

      uploadLimiterStore.set(userId, {
        count: current.count + 1,
        windowStart: current.windowStart,
      });
      next();
    } catch (err) {
      next(err);
    }
  };
}

function createFoodUploadMiddleware() {
  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_IMAGE_UPLOAD_BYTES,
      files: 1,
    },
    fileFilter: (_req, file, callback) => {
      if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
        callback(
          new BadRequestError("Only JPEG and PNG images are allowed"),
        );
        return;
      }

      callback(null, true);
    },
  }).single("image");

  return (req: Request, res: Response, next: NextFunction): void => {
    uploader(req, res, (err) => {
      if (!err) {
        next();
        return;
      }

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          next(new BadRequestError("Image must be 5MB or smaller"));
          return;
        }

        next(new BadRequestError(err.message));
        return;
      }

      next(err);
    });
  };
}

export function foodRoutes(
  controller: FoodController,
  supabaseAdmin: SupabaseClient,
): Router {
  const router = Router();
  const auth = authMiddleware(supabaseAdmin);
  const uploadRateLimit = createImageUploadRateLimitMiddleware();
  const foodUpload = createFoodUploadMiddleware();

  router.post("/", auth, controller.create);
  router.post("/analyze-image", auth, uploadRateLimit, foodUpload, controller.analyzeImage);
  router.get("/", auth, controller.list);

  return router;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import multer from "multer";
import { BadRequestError } from "../../../../core/errors/AppError.js";
import { authMiddleware } from "../../../../infrastructure/http/middleware/authMiddleware.js";
import type { FoodController } from "../controllers/FoodController.js";

const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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
          new BadRequestError("Only JPEG, PNG, and WebP images are allowed"),
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
  const foodUpload = createFoodUploadMiddleware();

  router.post("/", auth, controller.create);
  router.post("/analyze-image", auth, foodUpload, controller.analyzeImage);
  router.get("/", auth, controller.list);

  return router;
}

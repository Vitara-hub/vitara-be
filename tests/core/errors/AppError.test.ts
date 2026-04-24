import { describe, test, expect } from "bun:test";
import {
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from "../../../src/core/errors/AppError.js";

describe("AppError", () => {
  test("should create error with default values", () => {
    const error = new AppError("something went wrong");
    expect(error.message).toBe("something went wrong");
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  test("should create error with custom status code", () => {
    const error = new AppError("custom error", 422);
    expect(error.statusCode).toBe(422);
  });

  test("should create non-operational error", () => {
    const error = new AppError("fatal", 500, false);
    expect(error.isOperational).toBe(false);
  });
});

describe("NotFoundError", () => {
  test("should default to 'Resource not found'", () => {
    const error = new NotFoundError();
    expect(error.message).toBe("Resource not found");
    expect(error.statusCode).toBe(404);
  });

  test("should accept custom resource name", () => {
    const error = new NotFoundError("User");
    expect(error.message).toBe("User not found");
  });
});

describe("BadRequestError", () => {
  test("should have status 400", () => {
    const error = new BadRequestError("invalid input");
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("invalid input");
  });
});

describe("UnauthorizedError", () => {
  test("should have status 401", () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Unauthorized");
  });
});

describe("ForbiddenError", () => {
  test("should have status 403", () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
  });
});

describe("ConflictError", () => {
  test("should have status 409", () => {
    const error = new ConflictError("duplicate");
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe("duplicate");
  });
});

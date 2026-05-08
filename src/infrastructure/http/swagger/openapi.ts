export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Vitara API",
    description: "Health tracking backend — food, sleep, typing & health chatbot",
    version: "0.1.0",
    license: { name: "MIT" },
  },
  servers: [
    { url: "http://localhost:3000", description: "Local development" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Supabase access token",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object" as const,
        properties: {
          status: { type: "string" as const, example: "error" },
          message: { type: "string" as const },
        },
      },
      FoodEntry: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          userId: { type: "string" as const, format: "uuid" },
          name: { type: "string" as const, example: "Grilled Chicken Breast" },
          calories: { type: "number" as const, example: 250 },
          protein: { type: "number" as const, example: 40 },
          carbs: { type: "number" as const, example: 5 },
          fat: { type: "number" as const, example: 8 },
          mealType: { type: "string" as const, enum: ["breakfast", "lunch", "dinner", "snack"] },
          consumedAt: { type: "string" as const, format: "date-time" },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreateFoodEntry: {
        type: "object" as const,
        required: ["name", "calories", "protein", "carbs", "fat", "mealType", "consumedAt"],
        properties: {
          name: { type: "string" as const, minLength: 1 },
          calories: { type: "number" as const, minimum: 0 },
          protein: { type: "number" as const, minimum: 0 },
          carbs: { type: "number" as const, minimum: 0 },
          fat: { type: "number" as const, minimum: 0 },
          mealType: { type: "string" as const, enum: ["breakfast", "lunch", "dinner", "snack"] },
          consumedAt: { type: "string" as const, format: "date-time" },
        },
      },
      SleepEntry: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          userId: { type: "string" as const, format: "uuid" },
          startTime: { type: "string" as const, format: "date-time" },
          endTime: { type: "string" as const, format: "date-time" },
          quality: { type: "integer" as const, minimum: 1, maximum: 5 },
          notes: { type: "string" as const, nullable: true },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreateSleepEntry: {
        type: "object" as const,
        required: ["startTime", "endTime", "quality"],
        properties: {
          startTime: { type: "string" as const, format: "date-time" },
          endTime: { type: "string" as const, format: "date-time" },
          quality: { type: "integer" as const, minimum: 1, maximum: 5 },
          notes: { type: "string" as const },
        },
      },
      TypingSession: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          userId: { type: "string" as const, format: "uuid" },
          wpm: { type: "number" as const, example: 72 },
          accuracy: { type: "number" as const, example: 96.5 },
          duration: { type: "number" as const, example: 60, description: "Duration in seconds" },
          textContent: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreateTypingSession: {
        type: "object" as const,
        required: ["wpm", "accuracy", "duration", "textContent"],
        properties: {
          wpm: { type: "number" as const, minimum: 0 },
          accuracy: { type: "number" as const, minimum: 0, maximum: 100 },
          duration: { type: "number" as const, exclusiveMinimum: 0 },
          textContent: { type: "string" as const, minLength: 1 },
        },
      },
      ChatMessage: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          userId: { type: "string" as const, format: "uuid" },
          sessionId: { type: "string" as const, format: "uuid" },
          role: { type: "string" as const, enum: ["user", "assistant"] },
          content: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      SendMessage: {
        type: "object" as const,
        required: ["sessionId", "content"],
        properties: {
          sessionId: { type: "string" as const, format: "uuid" },
          content: { type: "string" as const, minLength: 1 },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Service is healthy",
            content: { "application/json": { schema: { type: "object" as const, properties: { status: { type: "string" as const, example: "ok" } } } } },
          },
        },
      },
    },
    "/api/food": {
      post: {
        tags: ["Food"],
        summary: "Create a food entry",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateFoodEntry" } } },
        },
        responses: {
          "201": {
            description: "Food entry created",
            content: { "application/json": { schema: { type: "object" as const, properties: { status: { type: "string" as const }, data: { $ref: "#/components/schemas/FoodEntry" } } } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      get: {
        tags: ["Food"],
        summary: "List food entries for the authenticated user",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "List of food entries",
            content: { "application/json": { schema: { type: "object" as const, properties: { status: { type: "string" as const }, data: { type: "array" as const, items: { $ref: "#/components/schemas/FoodEntry" } } } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/sleep": {
      post: {
        tags: ["Sleep"],
        summary: "Create a sleep entry",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateSleepEntry" } } },
        },
        responses: {
          "201": {
            description: "Sleep entry created",
            content: { "application/json": { schema: { type: "object" as const, properties: { status: { type: "string" as const }, data: { $ref: "#/components/schemas/SleepEntry" } } } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      get: {
        tags: ["Sleep"],
        summary: "List sleep entries for the authenticated user",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "List of sleep entries",
            content: { "application/json": { schema: { type: "object" as const, properties: { status: { type: "string" as const }, data: { type: "array" as const, items: { $ref: "#/components/schemas/SleepEntry" } } } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/typing": {
      post: {
        tags: ["Typing"],
        summary: "Create a typing session",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateTypingSession" } } },
        },
        responses: {
          "201": {
            description: "Typing session created",
            content: { "application/json": { schema: { type: "object" as const, properties: { status: { type: "string" as const }, data: { $ref: "#/components/schemas/TypingSession" } } } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      get: {
        tags: ["Typing"],
        summary: "List typing sessions for the authenticated user",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "List of typing sessions",
            content: { "application/json": { schema: { type: "object" as const, properties: { status: { type: "string" as const }, data: { type: "array" as const, items: { $ref: "#/components/schemas/TypingSession" } } } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/chat": {
      post: {
        tags: ["Chat"],
        summary: "Send a message to the health chatbot",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SendMessage" } } },
        },
        responses: {
          "201": {
            description: "Message sent and assistant replied",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  properties: {
                    status: { type: "string" as const },
                    data: {
                      type: "object" as const,
                      properties: {
                        userMsg: { $ref: "#/components/schemas/ChatMessage" },
                        assistantMsg: { $ref: "#/components/schemas/ChatMessage" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/chat/{sessionId}": {
      get: {
        tags: ["Chat"],
        summary: "Get chat history for a session",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "sessionId",
            in: "path" as const,
            required: true,
            schema: { type: "string" as const, format: "uuid" },
            description: "Chat session ID",
          },
        ],
        responses: {
          "200": {
            description: "Chat history",
            content: { "application/json": { schema: { type: "object" as const, properties: { status: { type: "string" as const }, data: { type: "array" as const, items: { $ref: "#/components/schemas/ChatMessage" } } } } } },
          },
          "400": { description: "Invalid sessionId", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
  },
};

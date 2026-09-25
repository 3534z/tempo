import OpenAI from "openai";

const ACTION_TYPES = [
  "create_task",
  "update_task",
  "delete_task",
  "create_event",
  "update_event",
  "create_reminder",
  "save_behavior_pattern",
] as const;

type ContextItem = Record<string, unknown>;
type NodeRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  on: (
    event: "data" | "end" | "error",
    listener: ((chunk: Uint8Array | string) => void) | (() => void) | ((error: Error) => void),
  ) => void;
};
type NodeResponse = {
  statusCode: number;
  writableEnded?: boolean;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};
type AiRequestBody = {
  message?: unknown;
  tasks?: unknown;
  events?: unknown;
  memory?: unknown;
  currentDate?: unknown;
  timeZone?: unknown;
};
type PlannedAction = {
  type: (typeof ACTION_TYPES)[number];
  id: string | null;
  title: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  address: string | null;
  reminderMinutes: number | null;
  reason: string | null;
  strategy: string | null;
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: {
      type: "string",
      description: "A short, natural response to the user.",
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ACTION_TYPES },
          id: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
          time: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          address: { type: ["string", "null"] },
          reminderMinutes: { type: ["integer", "null"] },
          reason: { type: ["string", "null"] },
          strategy: { type: ["string", "null"] },
        },
        required: [
          "type",
          "id",
          "title",
          "date",
          "time",
          "location",
          "address",
          "reminderMinutes",
          "reason",
          "strategy",
        ],
      },
    },
  },
  required: ["reply", "actions"],
} as const;

function header(request: NodeRequest, name: string) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function allowedOrigin(request: NodeRequest) {
  const origin = header(request, "origin");
  if (!origin) return "*";
  try {
    const originUrl = new URL(origin);
    const requestHost = header(request, "host");
    const configuredOrigin = process.env.APP_ORIGIN;
    if (
      originUrl.host === requestHost ||
      originUrl.hostname === "localhost" ||
      originUrl.hostname === "127.0.0.1" ||
      (configuredOrigin && origin === configuredOrigin)
    ) {
      return origin;
    }
  } catch {}
  return null;
}

function setCors(response: NodeResponse, origin: string) {
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
}

function json(
  response: NodeResponse,
  body: unknown,
  status: number,
  origin: string,
) {
  response.statusCode = status;
  setCors(response, origin);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: NodeRequest): Promise<AiRequestBody> {
  if (request.body !== undefined) {
    if (typeof request.body === "string") {
      return JSON.parse(request.body) as AiRequestBody;
    }
    if (request.body instanceof Uint8Array) {
      return JSON.parse(new TextDecoder().decode(request.body)) as AiRequestBody;
    }
    if (request.body && typeof request.body === "object") {
      return request.body as AiRequestBody;
    }
    throw new Error("Invalid JSON body");
  }

  return await new Promise<AiRequestBody>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    request.on("data", (chunk: Uint8Array | string) => {
      const bytes =
        typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
      size += bytes.byteLength;
      if (size > 128_000) {
        reject(new Error("Request body is too large"));
        return;
      }
      chunks.push(bytes);
    });
    request.on("end", () => {
      try {
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        resolve(JSON.parse(new TextDecoder().decode(bytes)) as AiRequestBody);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", (error: Error) => reject(error));
  });
}

function isContextArray(value: unknown): value is ContextItem[] {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 100 &&
      value.every(
        (item) =>
          !!item && typeof item === "object" && !Array.isArray(item),
      ))
  );
}

function cleanAction(action: PlannedAction) {
  return Object.fromEntries(
    Object.entries(action).filter(([, value]) => value !== null),
  );
}

function localNow(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      dateStyle: "full",
      timeStyle: "long",
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

export default async function handler(
  request: NodeRequest,
  res: NodeResponse,
) {
  let origin = "*";
  try {
    const acceptedOrigin = allowedOrigin(request);
    if (!acceptedOrigin) {
      json(res, { error: "Origin is not allowed" }, 403, "null");
      return;
    }
    origin = acceptedOrigin;

    const method = request.method?.toUpperCase();
    if (method === "OPTIONS") {
      res.statusCode = 204;
      setCors(res, origin);
      res.end();
      return;
    }
    if (method === "GET") {
      json(res, { ok: true }, 200, origin);
      return;
    }
    if (method !== "POST") {
      json(res, { error: "Method not allowed" }, 405, origin);
      return;
    }

    const contentType = header(request, "content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      json(
        res,
        { error: "Content-Type must be application/json" },
        415,
        origin,
      );
      return;
    }
    const contentLength = Number(header(request, "content-length") ?? 0);
    if (!Number.isFinite(contentLength) || contentLength > 128_000) {
      json(res, { error: "Request body is too large" }, 413, origin);
      return;
    }

    let body: AiRequestBody;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      const tooLarge =
        error instanceof Error && error.message === "Request body is too large";
      json(
        res,
        { error: tooLarge ? error.message : "Expected a JSON request body" },
        tooLarge ? 413 : 400,
        origin,
      );
      return;
    }
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 4_000) {
      json(
        res,
        { error: "message must contain between 1 and 4000 characters" },
        400,
        origin,
      );
      return;
    }
    if (
      !isContextArray(body.tasks) ||
      !isContextArray(body.events) ||
      !isContextArray(body.memory)
    ) {
      json(
        res,
        { error: "tasks, events and memory must be arrays of up to 100 objects" },
        400,
        origin,
      );
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      json(res, { error: "AI service is not configured" }, 503, origin);
      return;
    }
    const timeZone =
      typeof body.timeZone === "string" && body.timeZone.length <= 100
        ? body.timeZone
        : "Asia/Seoul";
    const currentDate =
      typeof body.currentDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.currentDate)
        ? body.currentDate
        : undefined;
    const context = {
      currentLocalDate: currentDate,
      currentLocalTime: localNow(timeZone),
      timeZone,
      tasks: body.tasks ?? [],
      events: body.events ?? [],
      memory: body.memory ?? [],
    };

    try {
      const openai = new OpenAI({ apiKey });
      const aiResponse = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        store: false,
        max_output_tokens: 900,
        instructions: [
          "You are Tempo, a concise personal planning assistant.",
          "Turn the user's request into zero or more supported actions.",
          "Use absolute YYYY-MM-DD dates and 24-hour HH:MM times.",
          "Interpret today, tomorrow, and weekdays from currentLocalDate in the supplied timezone; currentLocalDate is authoritative when present.",
          "Treat appointments as events and actionable personal work as tasks.",
          "Use existing IDs for update or delete actions when a matching item exists.",
          "Extract a naturally written venue, landmark, neighborhood, or street address into location. Preserve the user's wording. Use address for a full postal-style street address when useful.",
          "For requests that move or change a location, return an update action for the existing item with its ID and the new location. Do not create a duplicate.",
          "For create_reminder, use id or title to identify the existing item and put the lead time in reminderMinutes; date and time identify the item and must not represent a new task time.",
          "Use save_behavior_pattern when the user explains why something was missed; include the subject as title, their reason, and a practical future strategy.",
          "Use null for fields that do not apply. Keep reply brief and do not claim an action was saved yet.",
        ].join(" "),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Planning context:\n${JSON.stringify(context)}\n\nUser message:\n${message}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "tempo_plan",
            strict: true,
            schema: responseSchema,
          },
        },
      });
      if (!aiResponse.output_text) {
        json(res, { error: "AI returned no plan" }, 502, origin);
        return;
      }
      const result = JSON.parse(aiResponse.output_text) as {
        reply: string;
        actions: PlannedAction[];
      };
      json(
        res,
        {
          reply: result.reply,
          actions: result.actions.map(cleanAction),
        },
        200,
        origin,
      );
      return;
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        console.error("OpenAI request failed", {
          status: error.status,
          requestId: error.requestID,
        });
      } else {
        console.error("AI endpoint failed", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
      }
      json(
        res,
        { error: "AI service is temporarily unavailable" },
        502,
        origin,
      );
      return;
    }
  } catch (error) {
    console.error("Unhandled AI endpoint error", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    if (!res.writableEnded) {
      json(
        res,
        { error: "Internal server error" },
        500,
        origin,
      );
    }
  }
}

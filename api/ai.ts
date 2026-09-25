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
type AiRequestBody = {
  message?: unknown;
  tasks?: unknown;
  events?: unknown;
  memory?: unknown;
  timeZone?: unknown;
};
type PlannedAction = {
  type: (typeof ACTION_TYPES)[number];
  id: string | null;
  title: string | null;
  date: string | null;
  time: string | null;
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
          "reminderMinutes",
          "reason",
          "strategy",
        ],
      },
    },
  },
  required: ["reply", "actions"],
} as const;

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return "*";
  try {
    const originUrl = new URL(origin);
    const requestHost = request.headers.get("host") ?? new URL(request.url).host;
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

function json(body: unknown, status: number, origin: string) {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Origin": origin,
      "Cache-Control": "no-store",
      Vary: "Origin",
    },
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

export default async function handler(request: Request) {
  const origin = allowedOrigin(request);
  if (!origin) return json({ error: "Origin is not allowed" }, 403, "null");

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
      },
    });
  }
  if (request.method === "GET") return json({ ok: true }, 200, origin);
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Content-Type must be application/json" }, 415, origin);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 128_000) {
    return json({ error: "Request body is too large" }, 413, origin);
  }

  let body: AiRequestBody;
  try {
    body = (await request.json()) as AiRequestBody;
  } catch {
    return json({ error: "Expected a JSON request body" }, 400, origin);
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 4_000) {
    return json(
      { error: "message must contain between 1 and 4000 characters" },
      400,
      origin,
    );
  }
  if (
    !isContextArray(body.tasks) ||
    !isContextArray(body.events) ||
    !isContextArray(body.memory)
  ) {
    return json(
      { error: "tasks, events and memory must be arrays of up to 100 objects" },
      400,
      origin,
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "AI service is not configured" }, 503, origin);
  }
  const timeZone =
    typeof body.timeZone === "string" && body.timeZone.length <= 100
      ? body.timeZone
      : "UTC";
  const context = {
    currentLocalTime: localNow(timeZone),
    timeZone,
    tasks: body.tasks ?? [],
    events: body.events ?? [],
    memory: body.memory ?? [],
  };

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      store: false,
      max_output_tokens: 900,
      instructions: [
        "You are Tempo, a concise personal planning assistant.",
        "Turn the user's request into zero or more supported actions.",
        "Use absolute YYYY-MM-DD dates and 24-hour HH:MM times.",
        "Treat appointments as events and actionable personal work as tasks.",
        "Use existing IDs for update or delete actions when a matching item exists.",
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
    if (!response.output_text) {
      return json({ error: "AI returned no plan" }, 502, origin);
    }
    const result = JSON.parse(response.output_text) as {
      reply: string;
      actions: PlannedAction[];
    };
    return json(
      {
        reply: result.reply,
        actions: result.actions.map(cleanAction),
      },
      200,
      origin,
    );
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
    return json({ error: "AI service is temporarily unavailable" }, 502, origin);
  }
}

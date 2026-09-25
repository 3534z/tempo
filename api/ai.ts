type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type AiRequestBody = {
  prompt?: string;
  messages?: ChatMessage[];
};

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });

function getInput(body: AiRequestBody) {
  if (Array.isArray(body.messages)) {
    const messages = body.messages
      .filter(
        (message): message is ChatMessage =>
          !!message &&
          ["user", "assistant", "system"].includes(message.role) &&
          typeof message.content === "string" &&
          message.content.trim().length > 0,
      )
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, 8_000),
      }));

    if (messages.length) return messages;
  }

  if (typeof body.prompt === "string" && body.prompt.trim()) {
    return body.prompt.trim().slice(0, 16_000);
  }

  return null;
}

function getOutputText(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  if (payload.output_text) return payload.output_text;

  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text)
    .join("\n");
}

export default async function handler(request: Request) {
  if (request.method === "GET") {
    return json({ ok: true, service: "ai", accepts: "POST" });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 64_000) {
    return json({ error: "Request body is too large" }, 413);
  }

  let body: AiRequestBody;
  try {
    body = (await request.json()) as AiRequestBody;
  } catch {
    return json({ error: "Expected a JSON request body" }, 400);
  }

  const input = getInput(body);
  if (!input) {
    return json({ error: "Provide a prompt or messages" }, 400);
  }

  const env = (globalThis as RuntimeGlobals).process?.env;
  const apiKey = env?.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "AI service is not configured" }, 503);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env?.OPENAI_MODEL || "gpt-4.1-mini",
        input,
        max_output_tokens: 800,
      }),
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      output_text?: string;
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };

    if (!response.ok) {
      console.error(
        "OpenAI request failed",
        response.status,
        payload.error?.message,
      );
      return json({ error: "AI request failed" }, 502);
    }

    return json({ text: getOutputText(payload), response: payload });
  } catch (error) {
    console.error("AI request error", error);
    return json({ error: "AI service is temporarily unavailable" }, 502);
  }
}

import Anthropic from "@anthropic-ai/sdk";

import { REPLY_SCHEMA, SYSTEM_PROMPT, contextNote } from "./prompt.ts";
import { parseChatRequest, type ChatRequest } from "./validate.ts";

interface Env {
  /** Cloudflare Workers AI: free daily allowance, no API key. Used by default. */
  AI: Ai;
  /** Workers AI model, e.g. "@cf/meta/llama-3.3-70b-instruct-fp8-fast". */
  AI_MODEL: string;
  /** Optional: set this secret to use Claude instead (paid, smarter). */
  ANTHROPIC_API_KEY?: string;
  /** Optional, for local testing against a mock API. */
  ANTHROPIC_BASE_URL?: string;
  CLAUDE_MODEL: string;
  ALLOWED_ORIGINS: string;
  RATE_LIMITER: RateLimit;
}

/** What the app receives: Claude-style content blocks, whichever model answered. */
interface ChatResult {
  content: Record<string, unknown>[];
  stop_reason: string | null;
}

class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

// Models that support Anthropic's server-side refusal fallback.
const FALLBACK_MODELS = new Set([
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-sonnet-5-5",
  "claude-fable-5-2",
  "claude-fable-5-1",
]);

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  return {
    "Access-Control-Allow-Origin": origin && allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/** Free path: Cloudflare Workers AI. */
async function askWorkersAi(env: Env, req: ChatRequest): Promise<ChatResult> {
  const messages = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\nAlways reply with a single JSON object that matches the required schema.\n\n${contextNote(req.context)}`,
    },
    ...req.messages.map((m) => ({
      role: m.role,
      content:
        m.role === "user"
          ? m.content
          : m.content
              .filter((b) => b.type === "text" && typeof b.text === "string")
              .map((b) => b.text as string)
              .join(""),
    })),
  ];
  let out: unknown;
  try {
    out = await env.AI.run(
      env.AI_MODEL as keyof AiModels,
      {
        messages,
        max_tokens: 1500,
        response_format: { type: "json_schema", json_schema: REPLY_SCHEMA },
      } as never
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Workers AI error", msg);
    if (/4006|daily free allocation|neurons/i.test(msg)) {
      throw new UpstreamError(
        "The free AI has hit today's limit. It resets tomorrow (midnight UTC).",
        429
      );
    }
    if (/capacity|3040|overloaded/i.test(msg)) {
      throw new UpstreamError("The AI is busy right now. Try again in a moment.", 429);
    }
    throw new UpstreamError("The AI request failed. Try again.", 502);
  }
  // In JSON mode the reply can come back already parsed.
  const response = (out as { response?: unknown }).response;
  const text = typeof response === "string" ? response : JSON.stringify(response ?? {});
  return { content: [{ type: "text", text }], stop_reason: "end_turn" };
}

/** Paid path: Claude, used only when ANTHROPIC_API_KEY is set. */
async function askClaude(env: Env, req: ChatRequest): Promise<ChatResult> {
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.ANTHROPIC_BASE_URL || undefined,
  });
  const model = env.CLAUDE_MODEL || "claude-opus-5-5";
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      ...(FALLBACK_MODELS.has(model)
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
      system: `${SYSTEM_PROMPT}\n\n${contextNote(req.context)}`,
      output_config: { effort: "low", format: { type: "json_schema", schema: REPLY_SCHEMA } },
      messages: req.messages as Anthropic.Beta.BetaMessageParam[],
    });
    return {
      content: response.content as unknown as Record<string, unknown>[],
      stop_reason: response.stop_reason,
    };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new UpstreamError("The AI is busy right now. Try again in a moment.", 429);
    }
    if (err instanceof Anthropic.BadRequestError) {
      console.error("Anthropic rejected request", err.message);
      throw new UpstreamError("The AI couldn't handle that conversation. Start a new chat.", 400);
    }
    if (
      err instanceof Anthropic.AuthenticationError ||
      err instanceof Anthropic.PermissionDeniedError
    ) {
      console.error("Anthropic auth failed - check the ANTHROPIC_API_KEY secret", err.message);
      throw new UpstreamError("The AI isn't configured correctly.", 503);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      throw new UpstreamError("The AI request failed. Try again.", 502);
    }
    throw err;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname !== "/chat" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, cors);
    }

    // Browsers send Origin; block other websites from using this Worker.
    if (origin && cors["Access-Control-Allow-Origin"] !== origin) {
      return json({ error: "Origin not allowed" }, 403, cors);
    }

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success)
      return json({ error: "Too many requests. Wait a minute and try again." }, 429, cors);

    const parsed = parseChatRequest(await request.text());
    if (typeof parsed === "string") return json({ error: parsed }, 400, cors);

    try {
      const result = env.ANTHROPIC_API_KEY
        ? await askClaude(env, parsed)
        : await askWorkersAi(env, parsed);
      return json(result, 200, cors);
    } catch (err) {
      if (err instanceof UpstreamError) return json({ error: err.message }, err.status, cors);
      console.error("Unexpected error", err);
      return json({ error: "Something went wrong." }, 500, cors);
    }
  },
};

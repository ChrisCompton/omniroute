import Anthropic from "@anthropic-ai/sdk";

import { REPLY_SCHEMA, SYSTEM_PROMPT, contextNote } from "./prompt.ts";
import { parseChatRequest } from "./validate.ts";

interface Env {
  ANTHROPIC_API_KEY: string;
  /** Optional, for local testing against a mock API. */
  ANTHROPIC_BASE_URL?: string;
  ALLOWED_ORIGINS: string;
  MODEL: string;
  RATE_LIMITER: RateLimit;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname !== "/chat" || request.method !== "POST")
      return json({ error: "Not found" }, 404, cors);

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

    if (!env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY secret is not set");
      return json({ error: "The AI isn't configured yet." }, 503, cors);
    }

    const client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      baseURL: env.ANTHROPIC_BASE_URL || undefined,
    });
    const model = env.MODEL || "claude-opus-5-5";
    try {
      const response = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        ...(FALLBACK_MODELS.has(model)
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
        system: `${SYSTEM_PROMPT}\n\n${contextNote(parsed.context)}`,
        output_config: { effort: "low", format: { type: "json_schema", schema: REPLY_SCHEMA } },
        messages: parsed.messages as Anthropic.Beta.BetaMessageParam[],
      });
      return json({ content: response.content, stop_reason: response.stop_reason }, 200, cors);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        return json({ error: "The AI is busy right now. Try again in a moment." }, 429, cors);
      }
      if (err instanceof Anthropic.BadRequestError) {
        console.error("Anthropic rejected request", err.message);
        return json(
          { error: "The AI couldn't handle that conversation. Start a new chat." },
          400,
          cors
        );
      }
      if (
        err instanceof Anthropic.AuthenticationError ||
        err instanceof Anthropic.PermissionDeniedError
      ) {
        console.error("Anthropic auth failed - check the ANTHROPIC_API_KEY secret", err.message);
        return json({ error: "The AI isn't configured correctly." }, 503, cors);
      }
      if (err instanceof Anthropic.APIError) {
        console.error("Anthropic API error", err.status, err.message);
        return json({ error: "The AI request failed. Try again." }, 502, cors);
      }
      console.error("Unexpected error", err);
      return json({ error: "Something went wrong." }, 500, cors);
    }
  },
};

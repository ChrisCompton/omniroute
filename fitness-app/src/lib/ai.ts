import Anthropic from "@anthropic-ai/sdk";

import type { Macros, Meal, Profile, Targets } from "./types";

export const AI_MODEL = "claude-opus-5-5";

export interface EstimateItem {
  name: string;
  portion: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** One structured reply from the meal coach. */
export interface CoachReply {
  status: "asking" | "estimate" | "chat";
  message: string;
  options: string[];
  meal: Meal;
  items: EstimateItem[];
}

const REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "options", "meal", "items"],
  properties: {
    status: {
      type: "string",
      enum: ["asking", "estimate", "chat"],
      description:
        "asking = you need one more detail before estimating; estimate = items holds the final itemised estimate; chat = a general answer, nothing to log",
    },
    message: {
      type: "string",
      description: "What to say to the user. Short, friendly, plain text (no markdown tables).",
    },
    options: {
      type: "array",
      items: { type: "string" },
      description:
        "2-5 short tappable answers when asking (e.g. 'Small (fist-sized)', 'Medium', 'Large'). Empty otherwise.",
    },
    meal: {
      type: "string",
      enum: ["breakfast", "lunch", "dinner", "snack"],
      description: "Best guess at which meal this is, from what the user said or the time of day.",
    },
    items: {
      type: "array",
      description: "Only when status is estimate: one entry per food or drink. Empty otherwise.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "portion", "kcal", "protein", "carbs", "fat"],
        properties: {
          name: { type: "string" },
          portion: { type: "string", description: "e.g. '1 large burrito', '330 ml can'" },
          kcal: { type: "number" },
          protein: { type: "number", description: "grams" },
          carbs: { type: "number", description: "grams" },
          fat: { type: "number", description: "grams" },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are the nutrition coach inside Rowian Tracker, a calorie and fitness app. The user tells you what they ate or drank, and your job is to turn that into an accurate calorie and macro estimate they can log.

How to work:
- Before estimating, ask about the details that change the calories the most and that the user hasn't already given: portion size, how it was cooked (fried, grilled, oil or butter used), sauces, dressings, toppings, cheese, sugary drinks or alcohol, and the restaurant or brand if it is a known chain.
- Ask one question per reply, with 2-5 short tappable options. Describe portions with everyday references (a fist, a palm, a deck of cards, a standard can) so they are easy to answer.
- Stop asking after about three questions, or straight away if the user says to just estimate. When a detail is still unknown, assume a typical portion and say what you assumed in the message.
- When you estimate, list every food and drink separately with realistic numbers from standard nutrition data, and keep the message to a sentence or two (the app shows the numbers).
- If the user asks a general nutrition, diet or training question instead, answer it briefly with status "chat", using what you know about their goal and today's intake. Stay practical and encouraging, and don't give medical advice; suggest a doctor or dietitian for medical conditions.`;

export interface CoachContext {
  profile: Profile;
  targets: Targets;
  eatenToday: Macros;
  now?: Date;
}

function contextNote(c: CoachContext): string {
  const now = c.now ?? new Date();
  const goal = { lose: "lose fat", maintain: "maintain weight", gain: "build muscle" }[
    c.profile.goal
  ];
  return [
    `About the user: ${c.profile.age}-year-old ${c.profile.sex}, ${c.profile.heightCm} cm, ${c.profile.weightKg} kg, goal: ${goal}.`,
    `Daily targets: ${c.targets.kcal} kcal, ${c.targets.protein} g protein, ${c.targets.carbs} g carbs, ${c.targets.fat} g fat.`,
    `Logged so far today: ${Math.round(c.eatenToday.kcal)} kcal, ${Math.round(c.eatenToday.protein)} g protein.`,
    `Local time: ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
  ].join("\n");
}

export type ChatHistory = Anthropic.Beta.BetaMessageParam[];

export type AiErrorKind = "auth" | "rate" | "network" | "refusal" | "other";

export class AiError extends Error {
  readonly kind: AiErrorKind;
  constructor(message: string, kind: AiErrorKind) {
    super(message);
    this.kind = kind;
  }
}

/** Parse the model's JSON reply, tolerating minor deviations. */
export function parseReply(text: string): CoachReply {
  let raw: Partial<CoachReply> = {};
  try {
    raw = JSON.parse(text) as Partial<CoachReply>;
  } catch {
    return { status: "chat", message: text.trim(), options: [], meal: "snack", items: [] };
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0);
  const items = Array.isArray(raw.items)
    ? raw.items
        .filter((i): i is EstimateItem => !!i && typeof i.name === "string")
        .map((i) => ({
          name: i.name,
          portion: typeof i.portion === "string" ? i.portion : "1 serving",
          kcal: Math.round(num(i.kcal)),
          protein: Math.round(num(i.protein) * 10) / 10,
          carbs: Math.round(num(i.carbs) * 10) / 10,
          fat: Math.round(num(i.fat) * 10) / 10,
        }))
    : [];
  const meals: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
  const status =
    raw.status === "estimate" && items.length
      ? "estimate"
      : raw.status === "asking"
        ? "asking"
        : "chat";
  return {
    status,
    message: typeof raw.message === "string" ? raw.message : "",
    options: Array.isArray(raw.options)
      ? raw.options.filter((o) => typeof o === "string").slice(0, 5)
      : [],
    meal: meals.includes(raw.meal as Meal) ? (raw.meal as Meal) : "snack",
    items: status === "estimate" ? items : [],
  };
}

/**
 * Send the conversation to Claude and get the next structured reply.
 * Returns the reply plus the assistant turn to append to the history
 * (the full content, so thinking blocks are passed back unchanged next turn).
 */
export async function askCoach(
  apiKey: string,
  history: ChatHistory,
  ctx: CoachContext
): Promise<{ reply: CoachReply; assistantTurn: Anthropic.Beta.BetaMessageParam }> {
  // The key belongs to the person using the app and never leaves their device
  // except to call api.anthropic.com, so calling from the browser is intended here.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: `${SYSTEM_PROMPT}\n\n${contextNote(ctx)}`,
      output_config: { effort: "low", format: { type: "json_schema", schema: REPLY_SCHEMA } },
      messages: history,
    });
  } catch (err) {
    if (
      err instanceof Anthropic.AuthenticationError ||
      err instanceof Anthropic.PermissionDeniedError
    ) {
      throw new AiError("Your API key was rejected. Check it in the AI settings.", "auth");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AiError("Too many requests right now. Wait a moment and try again.", "rate");
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new AiError("Couldn't reach the AI. Check your internet connection.", "network");
    }
    if (err instanceof Anthropic.APIError) {
      throw new AiError(`The AI request failed (${err.status ?? "error"}). Try again.`, "other");
    }
    throw new AiError("Something went wrong talking to the AI.", "other");
  }

  if (response.stop_reason === "refusal") {
    throw new AiError("The AI declined to answer that one. Try rephrasing.", "refusal");
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return {
    reply: parseReply(text),
    assistantTurn: { role: "assistant", content: response.content },
  };
}

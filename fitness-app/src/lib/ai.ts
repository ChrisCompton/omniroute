import type { Macros, Meal, Profile, Targets } from "./types";

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

export interface CoachContext {
  profile: Profile;
  targets: Targets;
  eatenToday: Macros;
  now?: Date;
}

export type ChatTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: Record<string, unknown>[] };

export type ChatHistory = ChatTurn[];

/** The shared AI server (Cloudflare Worker in ai-proxy/). Set at build time. */
export const AI_PROXY_URL = (process.env.EXPO_PUBLIC_AI_PROXY_URL ?? "").replace(/\/+$/, "");

export type AiErrorKind = "rate" | "network" | "refusal" | "other";

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
 * Send the conversation to the shared AI server and get the next structured reply.
 * Returns the reply plus the assistant turn to append to the history (the full
 * content, so the model's thinking blocks are passed back unchanged next turn).
 */
export async function askCoach(
  history: ChatHistory,
  ctx: CoachContext
): Promise<{ reply: CoachReply; assistantTurn: ChatTurn }> {
  if (!AI_PROXY_URL) throw new AiError("The AI chat isn't switched on yet.", "other");
  const now = ctx.now ?? new Date();
  const context = {
    age: ctx.profile.age,
    sex: ctx.profile.sex,
    heightCm: ctx.profile.heightCm,
    weightKg: ctx.profile.weightKg,
    goal: ctx.profile.goal,
    targets: {
      kcal: ctx.targets.kcal,
      protein: ctx.targets.protein,
      carbs: ctx.targets.carbs,
      fat: ctx.targets.fat,
    },
    eatenKcal: Math.round(ctx.eatenToday.kcal),
    eatenProtein: Math.round(ctx.eatenToday.protein),
    localTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
  };

  let res: Response;
  try {
    res = await fetch(`${AI_PROXY_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, context }),
    });
  } catch {
    throw new AiError("Couldn't reach the AI. Check your internet connection.", "network");
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    content?: Record<string, unknown>[];
    stop_reason?: string;
  };
  if (!res.ok || !Array.isArray(data.content)) {
    throw new AiError(
      data.error ?? "The AI request failed. Try again.",
      res.status === 429 ? "rate" : "other"
    );
  }
  if (data.stop_reason === "refusal") {
    throw new AiError("The AI declined to answer that one. Try rephrasing.", "refusal");
  }
  const text = data.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
  return { reply: parseReply(text), assistantTurn: { role: "assistant", content: data.content } };
}

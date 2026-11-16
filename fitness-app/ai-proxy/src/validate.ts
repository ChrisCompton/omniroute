// Checks what the app sends before anything reaches the Anthropic API, so the
// Worker can only be used for meal chats, not as a free general-purpose AI.

export interface CoachContext {
  age: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  goal: "lose" | "maintain" | "gain";
  experience: "beginner" | "intermediate" | "advanced";
  equipment: "gym" | "home";
  daysPerWeek: number;
  targets: { kcal: number; protein: number; carbs: number; fat: number; steps: number };
  eaten: { kcal: number; protein: number; carbs: number; fat: number };
  steps: number;
  plan: { type: "train"; name: string; exercises: string[]; done: boolean } | { type: "rest" };
  workoutsThisWeek: number;
  localTime: string;
}

export type ChatTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: Record<string, unknown>[] };

export interface ChatRequest {
  messages: ChatTurn[];
  context: CoachContext;
}

export const LIMITS = {
  maxBodyBytes: 64_000,
  maxTurns: 25,
  maxUserChars: 2000,
};

const ASSISTANT_BLOCK_TYPES = new Set(["text", "thinking", "redacted_thinking", "fallback"]);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
    ? Math.round(v * 10) / 10
    : null;
}

// Names come from the app's own exercise library; allow only plain text.
const SAFE_NAME = /^[\p{L}\p{N} ()/,.'&+\-\u2013]{1,60}$/u;

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

function parseContext(c: unknown): CoachContext | string {
  if (!isObj(c) || !isObj(c.targets) || !isObj(c.eaten) || !isObj(c.plan))
    return "Missing context.";
  const t = c.targets;
  const e = c.eaten;
  const nums = {
    age: num(c.age, 10, 110),
    heightCm: num(c.heightCm, 100, 250),
    weightKg: num(c.weightKg, 25, 350),
    daysPerWeek: num(c.daysPerWeek, 1, 7),
    steps: num(c.steps, 0, 200000),
    workoutsThisWeek: num(c.workoutsThisWeek, 0, 50),
    tKcal: num(t.kcal, 500, 10000),
    tProtein: num(t.protein, 0, 1000),
    tCarbs: num(t.carbs, 0, 2000),
    tFat: num(t.fat, 0, 1000),
    tSteps: num(t.steps, 0, 100000),
    eKcal: num(e.kcal, 0, 50000),
    eProtein: num(e.protein, 0, 5000),
    eCarbs: num(e.carbs, 0, 10000),
    eFat: num(e.fat, 0, 5000),
  };
  if (Object.values(nums).some((n) => n === null)) return "Invalid numbers in context.";
  const n = nums as { [K in keyof typeof nums]: number };
  const sex = oneOf(c.sex, ["male", "female"] as const);
  const goal = oneOf(c.goal, ["lose", "maintain", "gain"] as const);
  const experience = oneOf(c.experience, ["beginner", "intermediate", "advanced"] as const);
  const equipment = oneOf(c.equipment, ["gym", "home"] as const);
  if (!sex || !goal || !experience || !equipment) return "Invalid profile in context.";

  let plan: CoachContext["plan"];
  if (c.plan.type === "rest") {
    plan = { type: "rest" };
  } else if (c.plan.type === "train") {
    const ex = c.plan.exercises;
    if (
      typeof c.plan.name !== "string" ||
      !SAFE_NAME.test(c.plan.name) ||
      !Array.isArray(ex) ||
      ex.length > 8 ||
      !ex.every((x) => typeof x === "string" && SAFE_NAME.test(x))
    ) {
      return "Invalid plan in context.";
    }
    plan = {
      type: "train",
      name: c.plan.name,
      exercises: ex as string[],
      done: c.plan.done === true,
    };
  } else {
    return "Invalid plan in context.";
  }

  const localTime =
    typeof c.localTime === "string" && /^[\d:apmAPM .]{3,12}$/.test(c.localTime)
      ? c.localTime
      : "unknown";
  return {
    age: n.age,
    sex,
    heightCm: n.heightCm,
    weightKg: n.weightKg,
    goal,
    experience,
    equipment,
    daysPerWeek: n.daysPerWeek,
    targets: { kcal: n.tKcal, protein: n.tProtein, carbs: n.tCarbs, fat: n.tFat, steps: n.tSteps },
    eaten: { kcal: n.eKcal, protein: n.eProtein, carbs: n.eCarbs, fat: n.eFat },
    steps: n.steps,
    plan,
    workoutsThisWeek: n.workoutsThisWeek,
    localTime,
  };
}

/** Returns the parsed request, or an error message for a 400 response. */
export function parseChatRequest(raw: string): ChatRequest | string {
  if (raw.length > LIMITS.maxBodyBytes) return "Conversation too long. Start a new chat.";
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return "Invalid JSON.";
  }
  if (!isObj(body) || !Array.isArray(body.messages)) return "Missing messages.";
  const msgs = body.messages;
  if (msgs.length === 0 || msgs.length > LIMITS.maxTurns)
    return "Conversation too long. Start a new chat.";

  const messages: ChatTurn[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const expected = i % 2 === 0 ? "user" : "assistant";
    if (!isObj(m) || m.role !== expected)
      return "Messages must alternate user/assistant, starting with user.";
    if (expected === "user") {
      if (typeof m.content !== "string" || !m.content.trim()) return "Empty message.";
      if (m.content.length > LIMITS.maxUserChars)
        return `Messages must be under ${LIMITS.maxUserChars} characters.`;
      messages.push({ role: "user", content: m.content });
    } else {
      if (!Array.isArray(m.content) || m.content.length === 0) return "Invalid assistant turn.";
      if (
        !m.content.every(
          (b) => isObj(b) && typeof b.type === "string" && ASSISTANT_BLOCK_TYPES.has(b.type)
        )
      ) {
        return "Invalid assistant turn.";
      }
      messages.push({ role: "assistant", content: m.content as Record<string, unknown>[] });
    }
  }
  if (messages[messages.length - 1].role !== "user")
    return "The last message must be from the user.";

  const context = parseContext(body.context);
  if (typeof context === "string") return context;
  return { messages, context };
}

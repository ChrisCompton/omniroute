// Checks what the app sends before anything reaches the Anthropic API, so the
// Worker can only be used for meal chats, not as a free general-purpose AI.

export interface CoachContext {
  age: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  goal: "lose" | "maintain" | "gain";
  targets: { kcal: number; protein: number; carbs: number; fat: number };
  eatenKcal: number;
  eatenProtein: number;
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
  maxUserChars: 1000,
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

function parseContext(c: unknown): CoachContext | string {
  if (!isObj(c) || !isObj(c.targets)) return "Missing context.";
  const t = c.targets;
  const out = {
    age: num(c.age, 10, 110),
    heightCm: num(c.heightCm, 100, 250),
    weightKg: num(c.weightKg, 25, 350),
    targets: {
      kcal: num(t.kcal, 500, 10000),
      protein: num(t.protein, 0, 1000),
      carbs: num(t.carbs, 0, 2000),
      fat: num(t.fat, 0, 1000),
    },
    eatenKcal: num(c.eatenKcal, 0, 50000),
    eatenProtein: num(c.eatenProtein, 0, 5000),
  };
  const nums = [
    out.age,
    out.heightCm,
    out.weightKg,
    out.eatenKcal,
    out.eatenProtein,
    ...Object.values(out.targets),
  ];
  if (nums.some((n) => n === null)) return "Invalid numbers in context.";
  if (c.sex !== "male" && c.sex !== "female") return "Invalid sex.";
  if (c.goal !== "lose" && c.goal !== "maintain" && c.goal !== "gain") return "Invalid goal.";
  const localTime =
    typeof c.localTime === "string" && /^[\d:apmAPM .]{3,12}$/.test(c.localTime)
      ? c.localTime
      : "unknown";
  return { ...(out as CoachContext), sex: c.sex, goal: c.goal, localTime };
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

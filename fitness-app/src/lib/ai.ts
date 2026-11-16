import type { Macros, Meal, Profile, Targets } from "./types";
import type { DayPlan } from "./workouts";

export interface FoodItemEstimate {
  name: string;
  portion: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface WorkoutEstimate {
  title: string;
  strength: { name: string; sets: number; reps: number; weightKg: number }[];
  cardio: { activity: string; minutes: number }[];
  kcalBurned: number;
}

export interface ExerciseTip {
  name: string;
  muscle: string;
  setsReps: string;
  steps: string[];
}

/** One structured reply from the AI coach. */
export interface CoachReply {
  message: string;
  options: string[];
  meal: Meal;
  foodItems: FoodItemEstimate[];
  /** null when the reply doesn't log a workout. */
  workout: WorkoutEstimate | null;
  exercises: ExerciseTip[];
}

export interface CoachContext {
  profile: Profile;
  targets: Targets;
  eatenToday: Macros;
  steps: number;
  plan: DayPlan;
  planDone: boolean;
  workoutsThisWeek: number;
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

const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function num(v: unknown, max = 100000): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;
}
function str(v: unknown, max = 120): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Parse the model's JSON reply, tolerating minor deviations. */
export function parseReply(text: string): CoachReply {
  const empty: CoachReply = {
    message: "",
    options: [],
    meal: "snack",
    foodItems: [],
    workout: null,
    exercises: [],
  };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ...empty, message: text.trim() };
  }
  if (!isObj(raw)) return { ...empty, message: text.trim() };

  const foodItems = (Array.isArray(raw.food_items) ? raw.food_items : [])
    .filter(isObj)
    .map((i) => ({
      name: str(i.name),
      portion: str(i.portion) || "1 serving",
      kcal: Math.round(num(i.kcal, 10000)),
      protein: r1(num(i.protein, 1000)),
      carbs: r1(num(i.carbs, 1000)),
      fat: r1(num(i.fat, 1000)),
    }))
    .filter((i) => i.name);

  let workout: WorkoutEstimate | null = null;
  if (isObj(raw.workout)) {
    const w = raw.workout;
    const strength = (Array.isArray(w.strength) ? w.strength : [])
      .filter(isObj)
      .map((x) => ({
        name: str(x.name),
        sets: Math.round(num(x.sets, 50)),
        reps: Math.round(num(x.reps, 500)),
        weightKg: r1(num(x.weightKg, 1000)),
      }))
      .filter((x) => x.name);
    const cardio = (Array.isArray(w.cardio) ? w.cardio : [])
      .filter(isObj)
      .map((x) => ({ activity: str(x.activity), minutes: Math.round(num(x.minutes, 1440)) }))
      .filter((x) => x.activity);
    const title = str(w.title, 60);
    if (title && (strength.length || cardio.length)) {
      workout = { title, strength, cardio, kcalBurned: Math.round(num(w.kcalBurned, 10000)) };
    }
  }

  const exercises = (Array.isArray(raw.exercises) ? raw.exercises : [])
    .filter(isObj)
    .map((e) => ({
      name: str(e.name),
      muscle: str(e.muscle),
      setsReps: str(e.setsReps, 40),
      steps: (Array.isArray(e.steps) ? e.steps : [])
        .map((s) => str(s, 300))
        .filter(Boolean)
        .slice(0, 5),
    }))
    .filter((e) => e.name)
    .slice(0, 6);

  return {
    message: str(raw.message, 4000),
    options: (Array.isArray(raw.options) ? raw.options : [])
      .map((o) => str(o, 60))
      .filter(Boolean)
      .slice(0, 5),
    meal: MEALS.includes(raw.meal as Meal) ? (raw.meal as Meal) : "snack",
    foodItems,
    workout,
    exercises,
  };
}

/** The context the AI server expects (see ai-proxy/src/validate.ts). */
export function buildContext(ctx: CoachContext) {
  const now = ctx.now ?? new Date();
  const p = ctx.profile;
  return {
    age: p.age,
    sex: p.sex,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    goal: p.goal,
    experience: p.experience,
    equipment: p.equipment,
    daysPerWeek: p.daysPerWeek,
    targets: {
      kcal: ctx.targets.kcal,
      protein: ctx.targets.protein,
      carbs: ctx.targets.carbs,
      fat: ctx.targets.fat,
      steps: ctx.targets.steps,
    },
    eaten: {
      kcal: Math.round(ctx.eatenToday.kcal),
      protein: Math.round(ctx.eatenToday.protein),
      carbs: Math.round(ctx.eatenToday.carbs),
      fat: Math.round(ctx.eatenToday.fat),
    },
    steps: Math.round(ctx.steps),
    plan:
      ctx.plan.type === "train"
        ? {
            type: "train" as const,
            name: ctx.plan.session.name,
            exercises: ctx.plan.session.exercises.map((e) => e.name),
            done: ctx.planDone,
          }
        : { type: "rest" as const },
    workoutsThisWeek: ctx.workoutsThisWeek,
    localTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
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
  if (!AI_PROXY_URL) throw new AiError("The AI coach isn't switched on yet.", "other");

  let res: Response;
  try {
    res = await fetch(`${AI_PROXY_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, context: buildContext(ctx) }),
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

/** A YouTube search for a form video, for the "Watch how" button. */
export function formVideoUrl(exercise: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise} proper form`)}`;
}

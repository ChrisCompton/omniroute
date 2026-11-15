import { stepsToMinutes } from "./calc.ts";
import type { Macros, Profile, Targets, WeightEntry } from "./types.ts";
import type { DayPlan } from "./workouts.ts";

export interface Tip {
  id: string;
  icon:
    | "flame"
    | "barbell"
    | "walk"
    | "nutrition"
    | "water"
    | "trending-down"
    | "trending-up"
    | "moon"
    | "trophy";
  title: string;
  body: string;
}

export interface CoachInput {
  profile: Profile;
  targets: Targets;
  eaten: Macros;
  steps: number;
  waterMl: number;
  plan: DayPlan;
  workoutFinished: boolean;
  weights: WeightEntry[];
  now?: Date;
}

/** Simple, rule-based daily coaching. Ordered roughly by priority. */
export function coachTips(i: CoachInput): Tip[] {
  const now = i.now ?? new Date();
  const hour = now.getHours();
  const tips: Tip[] = [];
  const kcalLeft = i.targets.kcal - i.eaten.kcal;
  const proteinLeft = i.targets.protein - i.eaten.protein;
  const stepsLeft = i.targets.steps - i.steps;

  // Workout
  if (i.plan.type === "train" && !i.workoutFinished) {
    tips.push({
      id: "workout",
      icon: "barbell",
      title: `Today is ${i.plan.session.name} day`,
      body: `${i.plan.session.exercises.length} exercises focused on ${i.plan.session.focus.toLowerCase()}. Open the Gym tab and tick off your sets.`,
    });
  } else if (i.plan.type === "train" && i.workoutFinished) {
    tips.push({
      id: "workout-done",
      icon: "trophy",
      title: "Workout done 💪",
      body: "Great work. Get 20–40 g of protein in within the next couple of hours to help recovery.",
    });
  } else if (i.plan.type === "rest") {
    tips.push({ id: "rest", icon: "moon", title: "Rest day", body: i.plan.suggestion });
  }

  // Calories
  if (i.eaten.kcal === 0 && hour >= 10) {
    tips.push({
      id: "log-food",
      icon: "nutrition",
      title: "Nothing logged yet",
      body: "Log your first meal so I can keep you on track — it takes 10 seconds in the Food tab.",
    });
  } else if (kcalLeft < -150) {
    tips.push({
      id: "over",
      icon: "flame",
      title: `${Math.abs(kcalLeft)} kcal over target`,
      body:
        i.profile.goal === "gain"
          ? "No stress — a surplus is part of the plan. Just keep it from becoming a habit of big overshoots."
          : `One day won't ruin progress. An extra ${stepsToMinutes(Math.abs(kcalLeft) * 25)} min walk helps, and keep tomorrow on plan.`,
    });
  } else if (kcalLeft > 0 && hour >= 18) {
    tips.push({
      id: "left",
      icon: "flame",
      title: `${kcalLeft} kcal left today`,
      body:
        kcalLeft > 600
          ? "You're well under — eat a proper dinner. Undereating stalls training and recovery."
          : "Plan a dinner that fits: lean protein + veg + a fist of carbs.",
    });
  }

  // Protein
  if (proteinLeft > 30 && hour >= 14) {
    tips.push({
      id: "protein",
      icon: "nutrition",
      title: `${Math.round(proteinLeft)} g protein to go`,
      body: "Easy wins: Greek yogurt (17 g), a protein shake (24 g), chicken breast (31 g / 100 g), or a can of tuna (29 g).",
    });
  }

  // Steps
  if (stepsLeft > 0) {
    tips.push({
      id: "steps",
      icon: "walk",
      title: `${stepsLeft.toLocaleString()} steps to go`,
      body: `That's about a ${stepsToMinutes(stepsLeft)}-minute brisk walk. Try a walk after your next meal — it also helps digestion and blood sugar.`,
    });
  } else {
    tips.push({
      id: "steps-done",
      icon: "trophy",
      title: "Step goal smashed",
      body: `You've hit ${i.targets.steps.toLocaleString()} steps. Anything extra is a bonus.`,
    });
  }

  // Water
  if (i.waterMl < i.targets.waterMl / 2 && hour >= 13) {
    tips.push({
      id: "water",
      icon: "water",
      title: "Drink some water",
      body: `You're at ${i.waterMl} ml of ${i.targets.waterMl} ml. Grab a glass now.`,
    });
  }

  // Weight trend
  const trend = weightTrend(i.weights);
  if (trend !== null) {
    const goal = i.profile.goal;
    const good =
      (goal === "lose" && trend < 0) ||
      (goal === "gain" && trend > 0) ||
      (goal === "maintain" && Math.abs(trend) < 0.3);
    tips.push({
      id: "trend",
      icon: trend < 0 ? "trending-down" : "trending-up",
      title: `${trend > 0 ? "+" : ""}${trend.toFixed(1)} kg over 2 weeks`,
      body: good
        ? "You're moving in the right direction. Keep doing what you're doing."
        : goal === "lose"
          ? "Weight isn't dropping yet. Tighten up logging (oils, drinks, snacks) or add 2,000 daily steps."
          : goal === "gain"
            ? "Scale isn't moving up. Add ~200 kcal a day — an extra snack like a PB banana works."
            : "You're drifting from maintenance. Nudge calories slightly the other way.",
    });
  }

  return tips;
}

/** Change in kg between the average of the first and last 3 weigh-ins in the last 14 days. */
export function weightTrend(weights: WeightEntry[], now: Date = new Date()): number | null {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 14);
  const recent = [...weights]
    .filter((w) => new Date(w.date) >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (recent.length < 4) return null;
  const avg = (xs: WeightEntry[]) => xs.reduce((s, w) => s + w.kg, 0) / xs.length;
  const n = Math.min(3, Math.floor(recent.length / 2));
  return Math.round((avg(recent.slice(-n)) - avg(recent.slice(0, n))) * 10) / 10;
}

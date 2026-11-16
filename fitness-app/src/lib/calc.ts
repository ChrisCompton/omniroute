import type { ActivityLevel, FoodEntry, Macros, Profile, Targets } from "./types.ts";

export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very: 1.9,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (desk job, little exercise)",
  light: "Light (exercise 1–3x / week)",
  moderate: "Moderate (exercise 3–5x / week)",
  active: "Active (hard exercise 6–7x / week)",
  very: "Very active (physical job + training)",
};

/** Mifflin–St Jeor basal metabolic rate, kcal/day. */
export function bmr(p: Pick<Profile, "sex" | "weightKg" | "heightCm" | "age">): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return Math.round(base + (p.sex === "male" ? 5 : -161));
}

export function tdee(p: Profile): number {
  return Math.round(bmr(p) * ACTIVITY_MULTIPLIER[p.activity]);
}

export function stepGoal(p: Profile): number {
  const base = p.goal === "lose" ? 10000 : p.goal === "maintain" ? 8000 : 7000;
  // Start sedentary people a bit lower so the goal is achievable; they can ramp up.
  const adj = p.activity === "sedentary" ? -2000 : p.activity === "light" ? -1000 : 0;
  return Math.max(5000, base + adj);
}

export function computeTargets(p: Profile): Targets {
  const b = bmr(p);
  const t = tdee(p);
  const floor = p.sex === "male" ? 1500 : 1200;
  let kcal = t;
  if (p.goal === "lose") kcal = Math.max(floor, t - 500);
  if (p.goal === "gain") kcal = t + 300;
  kcal = Math.round(kcal / 10) * 10;

  const proteinPerKg = p.goal === "lose" ? 2.0 : p.goal === "gain" ? 1.8 : 1.6;
  const protein = Math.round(p.weightKg * proteinPerKg);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return {
    bmr: b,
    tdee: t,
    kcal,
    protein,
    carbs,
    fat,
    steps: stepGoal(p),
    waterMl: Math.round((p.weightKg * 35) / 250) * 250,
  };
}

export function sumMacros(entries: FoodEntry[]): Macros {
  return entries.reduce<Macros>(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function bmi(p: Pick<Profile, "weightKg" | "heightCm">): number {
  const m = p.heightCm / 100;
  return Math.round((p.weightKg / (m * m)) * 10) / 10;
}

/** Rough kcal burned walking: ~0.04 kcal per step per 70 kg, scaled by body weight. */
export function stepsToKcal(steps: number, weightKg: number): number {
  return Math.round(steps * 0.04 * (weightKg / 70));
}

/** Minutes of brisk walking to cover `steps` (~100 steps/min). */
export function stepsToMinutes(steps: number): number {
  return Math.ceil(steps / 100);
}

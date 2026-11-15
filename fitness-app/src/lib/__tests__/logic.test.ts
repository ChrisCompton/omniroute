/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import { bmr, computeTargets, stepGoal, sumMacros } from "../calc.ts";
import { coachTips, weightTrend } from "../coach.ts";
import { FOODS, searchFoods } from "../foods.ts";
import type { Profile } from "../types.ts";
import { planForDate, weeklyPlan } from "../workouts.ts";

const base: Profile = {
  name: "Sam",
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activity: "moderate",
  goal: "lose",
  experience: "intermediate",
  daysPerWeek: 4,
  equipment: "gym",
};

test("BMR uses Mifflin–St Jeor", () => {
  // 10*80 + 6.25*180 - 5*30 + 5 = 1780
  assert.equal(bmr(base), 1780);
  assert.equal(bmr({ ...base, sex: "female" }), 1614);
});

test("targets apply a deficit/surplus and macros add up", () => {
  const lose = computeTargets(base);
  assert.equal(lose.tdee, Math.round(1780 * 1.55));
  assert.equal(lose.kcal, Math.round((lose.tdee - 500) / 10) * 10);
  assert.equal(lose.protein, 160);
  const macroKcal = lose.protein * 4 + lose.carbs * 4 + lose.fat * 9;
  assert.ok(Math.abs(macroKcal - lose.kcal) < 15);

  const gain = computeTargets({ ...base, goal: "gain" });
  assert.ok(gain.kcal > lose.kcal + 700);
});

test("calorie target never drops below the safety floor", () => {
  const tiny = computeTargets({
    ...base,
    sex: "female",
    weightKg: 45,
    heightCm: 150,
    age: 60,
    activity: "sedentary",
  });
  assert.ok(tiny.kcal >= 1200);
});

test("step goal depends on goal and activity", () => {
  assert.equal(stepGoal(base), 10000);
  assert.equal(stepGoal({ ...base, activity: "sedentary" }), 8000);
  assert.equal(stepGoal({ ...base, goal: "gain", activity: "sedentary" }), 5000);
});

test("weekly plan has the requested number of training days", () => {
  for (let days = 2; days <= 6; days++) {
    const plan = weeklyPlan({ ...base, daysPerWeek: days });
    assert.equal(plan.length, 7);
    assert.equal(plan.filter((d) => d.type === "train").length, days);
    assert.equal(plan[0].type, "rest", "Sunday is always a rest day");
  }
});

test("home equipment swaps exercise names and beginners get fewer exercises", () => {
  const monday = new Date(2026, 10, 16); // a Monday
  const gym = planForDate(base, monday);
  const home = planForDate({ ...base, equipment: "home", experience: "beginner" }, monday);
  assert.equal(gym.type, "train");
  assert.equal(home.type, "train");
  if (gym.type === "train" && home.type === "train") {
    assert.notEqual(gym.session.exercises[0].name, home.session.exercises[0].name);
    assert.equal(home.session.exercises.length, 5);
    assert.equal(gym.session.exercises.length, 6);
  }
});

test("food search matches all terms", () => {
  assert.ok(FOODS.length > 60);
  const r = searchFoods("chicken breast");
  assert.ok(r.length >= 1);
  assert.ok(r.every((f) => f.name.toLowerCase().includes("chicken")));
  assert.equal(searchFoods("zzzz").length, 0);
});

test("sumMacros totals entries", () => {
  const e = {
    id: "1",
    date: "2026-11-15",
    meal: "lunch" as const,
    name: "x",
    serving: "1",
    servings: 1,
    createdAt: 0,
  };
  const t = sumMacros([
    { ...e, kcal: 100, protein: 10, carbs: 5, fat: 2 },
    { ...e, kcal: 200, protein: 5, carbs: 30, fat: 4 },
  ]);
  assert.deepEqual(t, { kcal: 300, protein: 15, carbs: 35, fat: 6 });
});

test("weight trend needs 4+ weigh-ins and reports the change", () => {
  const now = new Date(2026, 10, 15);
  assert.equal(weightTrend([{ date: "2026-11-14", kg: 80 }], now), null);
  const w = [80.0, 79.8, 79.9, 79.5, 79.2, 79.0].map((kg, i) => ({
    date: `2026-11-${String(5 + i * 2).padStart(2, "0")}`,
    kg,
  }));
  const t = weightTrend(w, now);
  assert.ok(t !== null && t < 0);
});

test("coach nudges about steps, protein and the workout", () => {
  const targets = computeTargets(base);
  const monday = new Date(2026, 10, 16, 19, 0);
  const tips = coachTips({
    profile: base,
    targets,
    eaten: { kcal: 1200, protein: 60, carbs: 100, fat: 40 },
    steps: 3000,
    waterMl: 500,
    plan: planForDate(base, monday),
    workoutFinished: false,
    weights: [],
    now: monday,
  });
  const ids = tips.map((t) => t.id);
  assert.ok(ids.includes("workout"));
  assert.ok(ids.includes("steps"));
  assert.ok(ids.includes("protein"));
  assert.ok(ids.includes("left"));
  assert.ok(ids.includes("water"));
});

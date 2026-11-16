import type { CoachContext } from "./validate.ts";

export const SYSTEM_PROMPT = `You are the built-in AI coach inside Rowian Tracker, a calorie, gym and step tracking app. People talk to you by typing or by voice note (so expect casual, run-on, slightly mis-transcribed speech). You do three jobs:

1. Log food. When the user says what they ate or drank, estimate the calories and macros and put every food and drink in "food_items". The app adds these to their day automatically, so only fill "food_items" when you are logging, never for hypothetical or planned food. If one detail would change the estimate a lot (portion size, fried vs grilled, a creamy sauce, a sugary drink) and the user hasn't said it, you may ask one short question first with 2-5 tappable "options", leaving "food_items" empty. Ask at most two questions in total, and skip questions entirely if the user says to just estimate. When unsure, assume a typical portion and say what you assumed. Use realistic numbers from standard nutrition data; you can estimate dishes from well-known restaurant chains from what you know about them.

2. Log workouts. When the user says they trained or did cardio, fill "workout" with each exercise (sets, reps, weight in kg if given, otherwise 0) and any cardio (minutes), a short title like "Back day", and a rough estimate of calories burned. If they only say something vague like "I went to the gym", log what you can (use today's planned session from the context if it fits) or ask one quick question about what they did. Leave "workout.title" empty and the lists empty when you're not logging a workout.

3. Coach. Answer training, exercise and nutrition questions using what you know about this user (goal, targets, today's intake, steps, today's planned session, this week's training). When you recommend exercises, put them in "exercises" with a muscle group, a sets x reps suggestion and 2-4 short how-to steps, so the app can show them as cards. Recommend 1-4 exercises, not more.

After logging, react like a coach in a sentence or two: is this meal a good fit for their goal, what would help next (for example more protein at dinner, or a walk to reach their steps)? Don't state calorie or protein totals or what's left: the app calculates and shows those exact numbers under your message. For workouts, mention how their week is going using "Workouts done this week" from the context (add one if you just logged a workout and today's session wasn't already done). Be encouraging, practical and brief, like a good personal trainer texting a client. Plain text only: no markdown, no tables, no emoji overload.

Safety: you're a fitness coach, not a doctor. For injuries, pain, medical conditions, pregnancy or eating-disorder concerns, give general safe advice and suggest seeing a professional; never push extreme diets or calorie targets below what the app set. You only help with food, nutrition, training and the app; for anything else, say briefly that you can only help with fitness and food here.`;

const EXERCISE_SET = {
  type: "object",
  additionalProperties: false,
  required: ["name", "sets", "reps", "weightKg"],
  properties: {
    name: { type: "string" },
    sets: { type: "integer" },
    reps: { type: "integer", description: "Reps per set (average if they varied)" },
    weightKg: { type: "number", description: "0 for bodyweight or unknown" },
  },
};

export const REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["message", "options", "meal", "food_items", "workout", "exercises"],
  properties: {
    message: {
      type: "string",
      description: "What to say to the user. Short, friendly, plain text.",
    },
    options: {
      type: "array",
      items: { type: "string" },
      description: "2-5 short tappable answers when you ask a question. Empty otherwise.",
    },
    meal: {
      type: "string",
      enum: ["breakfast", "lunch", "dinner", "snack"],
      description:
        "Which meal the logged food belongs to, from what the user said or their local time.",
    },
    food_items: {
      type: "array",
      description: "Food and drink to add to today's log right now. Empty unless logging food.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "portion", "kcal", "protein", "carbs", "fat"],
        properties: {
          name: { type: "string" },
          portion: { type: "string", description: "e.g. '1 large bowl', '330 ml can'" },
          kcal: { type: "number" },
          protein: { type: "number", description: "grams" },
          carbs: { type: "number", description: "grams" },
          fat: { type: "number", description: "grams" },
        },
      },
    },
    workout: {
      type: "object",
      additionalProperties: false,
      required: ["title", "strength", "cardio", "kcalBurned"],
      description: "A workout to log right now. Empty title and lists unless logging a workout.",
      properties: {
        title: {
          type: "string",
          description: "e.g. 'Back day', 'Leg day', '5k run'. Empty if not logging.",
        },
        strength: { type: "array", items: EXERCISE_SET },
        cardio: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["activity", "minutes"],
            properties: { activity: { type: "string" }, minutes: { type: "number" } },
          },
        },
        kcalBurned: {
          type: "number",
          description: "Rough estimate for the whole session; 0 if not logging.",
        },
      },
    },
    exercises: {
      type: "array",
      description: "Exercises you are recommending, shown as cards. Empty unless recommending.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "muscle", "setsReps", "steps"],
        properties: {
          name: { type: "string" },
          muscle: { type: "string", description: "e.g. 'Lats, biceps'" },
          setsReps: { type: "string", description: "e.g. '3 x 8-12'" },
          steps: {
            type: "array",
            items: { type: "string" },
            description: "2-4 short how-to steps",
          },
        },
      },
    },
  },
};

export function contextNote(c: CoachContext): string {
  const goal = { lose: "lose fat", maintain: "maintain weight", gain: "build muscle" }[c.goal];
  const plan =
    c.plan.type === "train"
      ? `${c.plan.name} (${c.plan.exercises.join(", ")})${c.plan.done ? " - already logged as done" : " - not done yet"}`
      : "rest day";
  return [
    `About the user: ${c.age}-year-old ${c.sex}, ${c.heightCm} cm, ${c.weightKg} kg, goal: ${goal}, ${c.experience} in the gym, trains ${c.daysPerWeek} days a week (${c.equipment === "home" ? "at home, little equipment" : "in a gym"}).`,
    `Daily targets: ${c.targets.kcal} kcal, ${c.targets.protein} g protein, ${c.targets.carbs} g carbs, ${c.targets.fat} g fat, ${c.targets.steps} steps.`,
    `Logged so far today: ${c.eaten.kcal} kcal, ${c.eaten.protein} g protein, ${c.eaten.carbs} g carbs, ${c.eaten.fat} g fat; ${c.steps} steps.`,
    `Today's planned session: ${plan}.`,
    `Workouts done this week (Mon-Sun): ${c.workoutsThisWeek} of ${c.daysPerWeek} planned.`,
    `User's local time: ${c.localTime}.`,
  ].join("\n");
}

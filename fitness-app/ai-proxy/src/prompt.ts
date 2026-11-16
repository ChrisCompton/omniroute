import type { CoachContext } from "./validate.ts";

export const SYSTEM_PROMPT = `You are the nutrition coach inside Rowian Tracker, a calorie and fitness app. The user tells you what they ate or drank, and your job is to turn that into an accurate calorie and macro estimate they can log.

How to work:
- Before estimating, ask about the details that change the calories the most and that the user hasn't already given: portion size, how it was cooked (fried, grilled, oil or butter used), sauces, dressings, toppings, cheese, sugary drinks or alcohol, and the restaurant or brand if it is a known chain.
- Ask one question per reply, with 2-5 short tappable options. Describe portions with everyday references (a fist, a palm, a deck of cards, a standard can) so they are easy to answer.
- Stop asking after about three questions, or straight away if the user says to just estimate. When a detail is still unknown, assume a typical portion and say what you assumed in the message.
- When you estimate, list every food and drink separately with realistic numbers from standard nutrition data, and keep the message to a sentence or two (the app shows the numbers).
- If the user asks a general nutrition, diet or training question instead, answer it briefly with status "chat", using what you know about their goal and today's intake. Stay practical and encouraging, and don't give medical advice; suggest a doctor or dietitian for medical conditions.
- You only help with food, nutrition and fitness. If asked for anything else, say briefly that you can only help with meals and fitness in this app.`;

export const REPLY_SCHEMA = {
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
};

export function contextNote(c: CoachContext): string {
  const goal = { lose: "lose fat", maintain: "maintain weight", gain: "build muscle" }[c.goal];
  return [
    `About the user: ${c.age}-year-old ${c.sex}, ${c.heightCm} cm, ${c.weightKg} kg, goal: ${goal}.`,
    `Daily targets: ${c.targets.kcal} kcal, ${c.targets.protein} g protein, ${c.targets.carbs} g carbs, ${c.targets.fat} g fat.`,
    `Logged so far today: ${c.eatenKcal} kcal, ${c.eatenProtein} g protein.`,
    `User's local time: ${c.localTime}.`,
  ].join("\n");
}

import type { Equipment, Experience, Goal, Profile } from "./types.ts";

export interface Exercise {
  id: string;
  name: string;
  homeName: string;
  muscle: string;
  compound: boolean;
  cue: string;
}

export interface PlannedExercise {
  id: string;
  name: string;
  muscle: string;
  sets: number;
  reps: string;
  restSec: number;
  cue: string;
}

export interface Session {
  name: string;
  focus: string;
  exercises: PlannedExercise[];
  cardio: string | null;
}

export type DayPlan = { type: "train"; session: Session } | { type: "rest"; suggestion: string };

const EX: Record<string, Exercise> = {
  squat: {
    id: "squat",
    name: "Barbell back squat",
    homeName: "Goblet squat (backpack/dumbbell)",
    muscle: "Quads, glutes",
    compound: true,
    cue: "Brace your core, knees track over toes, hips below parallel if mobility allows.",
  },
  rdl: {
    id: "rdl",
    name: "Romanian deadlift",
    homeName: "Single-leg RDL",
    muscle: "Hamstrings, glutes",
    compound: true,
    cue: "Soft knees, push hips back, keep the bar close and back flat.",
  },
  deadlift: {
    id: "deadlift",
    name: "Deadlift",
    homeName: "Hip thrust (on sofa)",
    muscle: "Posterior chain",
    compound: true,
    cue: "Bar over mid-foot, chest up, drive the floor away.",
  },
  lunge: {
    id: "lunge",
    name: "Walking lunges",
    homeName: "Reverse lunges",
    muscle: "Quads, glutes",
    compound: true,
    cue: "Long stride, back knee kisses the floor, torso upright.",
  },
  legpress: {
    id: "legpress",
    name: "Leg press",
    homeName: "Bulgarian split squat",
    muscle: "Quads",
    compound: true,
    cue: "Full range without the lower back peeling off the pad.",
  },
  legcurl: {
    id: "legcurl",
    name: "Lying leg curl",
    homeName: "Sliding leg curl (towel)",
    muscle: "Hamstrings",
    compound: false,
    cue: "Control the lowering for 2–3 seconds.",
  },
  calf: {
    id: "calf",
    name: "Standing calf raise",
    homeName: "Single-leg calf raise (step)",
    muscle: "Calves",
    compound: false,
    cue: "Pause at the top and the full stretch at the bottom.",
  },
  bench: {
    id: "bench",
    name: "Barbell bench press",
    homeName: "Push-ups",
    muscle: "Chest, triceps",
    compound: true,
    cue: "Shoulder blades pinned, feet planted, bar to lower chest.",
  },
  incline: {
    id: "incline",
    name: "Incline dumbbell press",
    homeName: "Decline push-ups (feet raised)",
    muscle: "Upper chest",
    compound: true,
    cue: "30° bench, elbows ~45° from your body.",
  },
  ohp: {
    id: "ohp",
    name: "Overhead press",
    homeName: "Pike push-ups",
    muscle: "Shoulders",
    compound: true,
    cue: "Squeeze glutes, press straight up, head through at the top.",
  },
  lateral: {
    id: "lateral",
    name: "Lateral raises",
    homeName: "Lateral raises (water bottles)",
    muscle: "Side delts",
    compound: false,
    cue: "Lead with the elbows, stop at shoulder height.",
  },
  dips: {
    id: "dips",
    name: "Dips",
    homeName: "Chair dips",
    muscle: "Triceps, chest",
    compound: true,
    cue: "Slight forward lean, elbows don't flare.",
  },
  triceps: {
    id: "triceps",
    name: "Cable triceps pushdown",
    homeName: "Diamond push-ups",
    muscle: "Triceps",
    compound: false,
    cue: "Elbows glued to your sides.",
  },
  pullup: {
    id: "pullup",
    name: "Pull-ups / lat pulldown",
    homeName: "Door-frame or table rows",
    muscle: "Lats, biceps",
    compound: true,
    cue: "Pull elbows to your back pockets, chest up.",
  },
  row: {
    id: "row",
    name: "Barbell row",
    homeName: "Backpack bent-over row",
    muscle: "Upper back",
    compound: true,
    cue: "Hinge to ~45°, row to the belly button, no jerking.",
  },
  cablerow: {
    id: "cablerow",
    name: "Seated cable row",
    homeName: "Towel isometric row",
    muscle: "Mid back",
    compound: true,
    cue: "Squeeze shoulder blades together for a beat.",
  },
  facepull: {
    id: "facepull",
    name: "Face pulls",
    homeName: "Prone Y-T raises",
    muscle: "Rear delts",
    compound: false,
    cue: "Pull to your forehead, thumbs back.",
  },
  curl: {
    id: "curl",
    name: "Dumbbell curls",
    homeName: "Backpack curls",
    muscle: "Biceps",
    compound: false,
    cue: "No swinging — keep elbows still.",
  },
  plank: {
    id: "plank",
    name: "Plank",
    homeName: "Plank",
    muscle: "Core",
    compound: false,
    cue: "Straight line head to heels, squeeze glutes.",
  },
  hanging: {
    id: "hanging",
    name: "Hanging knee raises",
    homeName: "Dead bugs",
    muscle: "Core",
    compound: false,
    cue: "Move slowly, keep the lower back from arching.",
  },
};

const SESSIONS: Record<string, { focus: string; ids: string[] }> = {
  "Full Body A": {
    focus: "Squat, push, pull",
    ids: ["squat", "bench", "row", "ohp", "legcurl", "plank"],
  },
  "Full Body B": {
    focus: "Hinge, push, pull",
    ids: ["deadlift", "incline", "pullup", "lunge", "lateral", "hanging"],
  },
  "Full Body C": {
    focus: "Legs, push, pull",
    ids: ["legpress", "ohp", "cablerow", "rdl", "curl", "plank"],
  },
  Upper: {
    focus: "Chest, back, shoulders, arms",
    ids: ["bench", "row", "ohp", "pullup", "curl", "triceps"],
  },
  Lower: {
    focus: "Quads, hamstrings, glutes, calves",
    ids: ["squat", "rdl", "legpress", "legcurl", "calf", "plank"],
  },
  Push: {
    focus: "Chest, shoulders, triceps",
    ids: ["bench", "incline", "ohp", "lateral", "dips", "triceps"],
  },
  Pull: {
    focus: "Back, rear delts, biceps",
    ids: ["deadlift", "pullup", "cablerow", "facepull", "curl", "hanging"],
  },
  Legs: {
    focus: "Quads, hamstrings, glutes, calves",
    ids: ["squat", "rdl", "lunge", "legcurl", "calf", "plank"],
  },
};

/** Weekday indices (0 = Sun) that are training days for a given frequency. */
export const TRAINING_DAYS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

const ROTATION: Record<number, string[]> = {
  2: ["Full Body A", "Full Body B"],
  3: ["Full Body A", "Full Body B", "Full Body C"],
  4: ["Upper", "Lower", "Upper", "Lower"],
  5: ["Upper", "Lower", "Push", "Pull", "Legs"],
  6: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"],
};

function prescription(goal: Goal, exp: Experience, compound: boolean) {
  const sets = exp === "beginner" ? 3 : compound ? 4 : 3;
  if (goal === "gain") {
    return compound ? { sets, reps: "6–10", restSec: 120 } : { sets, reps: "10–12", restSec: 75 };
  }
  if (goal === "lose") {
    return compound ? { sets, reps: "8–12", restSec: 90 } : { sets, reps: "12–15", restSec: 45 };
  }
  return compound ? { sets, reps: "8–10", restSec: 90 } : { sets, reps: "10–15", restSec: 60 };
}

function cardioFor(goal: Goal): string | null {
  if (goal === "lose")
    return "Finish with 15–20 min incline walk or bike (zone 2 — you can still talk).";
  if (goal === "maintain") return "Optional: 10 min easy cardio to cool down.";
  return null;
}

export function buildSession(
  name: string,
  p: Pick<Profile, "goal" | "experience" | "equipment">
): Session {
  const def = SESSIONS[name];
  const exercises = def.ids
    // Beginners get 5 exercises to keep sessions short and recoverable.
    .slice(0, p.experience === "beginner" ? 5 : 6)
    .map((id) => {
      const e = EX[id];
      const rx = prescription(p.goal, p.experience, e.compound);
      const isTimed = id === "plank";
      return {
        id,
        name: p.equipment === "home" ? e.homeName : e.name,
        muscle: e.muscle,
        cue: e.cue,
        sets: rx.sets,
        reps: isTimed ? (p.experience === "beginner" ? "30 s" : "45–60 s") : rx.reps,
        restSec: rx.restSec,
      };
    });
  return { name, focus: def.focus, exercises, cardio: cardioFor(p.goal) };
}

export function clampDays(n: number): number {
  return Math.min(6, Math.max(2, Math.round(n)));
}

export function weeklyPlan(
  p: Pick<Profile, "goal" | "experience" | "equipment" | "daysPerWeek">
): DayPlan[] {
  const days = clampDays(p.daysPerWeek);
  const trainDays = TRAINING_DAYS[days];
  const rotation = ROTATION[days];
  return Array.from({ length: 7 }, (_, weekday) => {
    const idx = trainDays.indexOf(weekday);
    if (idx === -1) {
      return {
        type: "rest" as const,
        suggestion:
          p.goal === "lose"
            ? "Active recovery: hit your step goal and do 10 min of stretching."
            : "Rest day: easy walk, mobility, and plenty of sleep so you grow.",
      };
    }
    return { type: "train" as const, session: buildSession(rotation[idx], p) };
  });
}

export function planForDate(p: Profile, d: Date = new Date()): DayPlan {
  return weeklyPlan(p)[d.getDay()];
}

export function sessionMinutes(s: Session): number {
  const work = s.exercises.reduce((acc, e) => acc + e.sets * (45 + e.restSec), 0);
  return Math.round(work / 60) + (s.cardio && s.cardio.startsWith("Finish") ? 18 : 0) + 8;
}

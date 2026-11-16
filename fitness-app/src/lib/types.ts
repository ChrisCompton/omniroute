export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very";
export type Goal = "lose" | "maintain" | "gain";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Equipment = "gym" | "home";
export type Meal = "breakfast" | "lunch" | "dinner" | "snack";

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  experience: Experience;
  daysPerWeek: number;
  equipment: Equipment;
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Targets extends Macros {
  bmr: number;
  tdee: number;
  steps: number;
  waterMl: number;
}

export interface FoodItem extends Macros {
  id: string;
  name: string;
  serving: string;
  category: string;
}

export interface FoodEntry extends Macros {
  id: string;
  date: string;
  meal: Meal;
  name: string;
  serving: string;
  servings: number;
  createdAt: number;
}

export interface WeightEntry {
  date: string;
  kg: number;
}

export interface WorkoutLog {
  date: string;
  sessionName: string;
  completed: string[];
  finished: boolean;
}

export interface AppData {
  profile: Profile | null;
  foods: FoodEntry[];
  weights: WeightEntry[];
  steps: Record<string, number>;
  workouts: Record<string, WorkoutLog>;
  water: Record<string, number>;
}

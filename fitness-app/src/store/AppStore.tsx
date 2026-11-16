import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { computeTargets } from "@/lib/calc";
import { dateKey } from "@/lib/date";
import type { AppData, FoodEntry, Profile, Targets, WorkoutLog } from "@/lib/types";

const STORAGE_KEY = "rowiantracker:v1";

const EMPTY: AppData = {
  profile: null,
  foods: [],
  weights: [],
  steps: {},
  workouts: {},
  water: {},
  aiKey: "",
};

interface Store {
  ready: boolean;
  data: AppData;
  targets: Targets | null;
  saveProfile: (p: Profile) => void;
  addFood: (e: Omit<FoodEntry, "id" | "createdAt">) => void;
  removeFood: (id: string) => void;
  setSteps: (date: string, steps: number) => void;
  addWater: (ml: number, date?: string) => void;
  logWeight: (kg: number, date?: string) => void;
  toggleExercise: (date: string, sessionName: string, exerciseId: string) => void;
  setWorkoutFinished: (date: string, sessionName: string, finished: boolean) => void;
  setAiKey: (key: string) => void;
  resetAll: () => void;
}

const Ctx = createContext<Store | null>(null);

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setData({ ...EMPTY, ...(JSON.parse(raw) as Partial<AppData>) });
      })
      .catch((err: unknown) => console.warn("Failed to load saved data", err))
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((err: unknown) =>
      console.warn("Failed to save data", err)
    );
  }, [data]);

  const saveProfile = useCallback((p: Profile) => {
    setData((d) => {
      const today = dateKey();
      const weights = d.weights.filter((w) => w.date !== today);
      return { ...d, profile: p, weights: [...weights, { date: today, kg: p.weightKg }] };
    });
  }, []);

  const addFood = useCallback((e: Omit<FoodEntry, "id" | "createdAt">) => {
    setData((d) => ({ ...d, foods: [...d.foods, { ...e, id: uid(), createdAt: Date.now() }] }));
  }, []);

  const removeFood = useCallback((id: string) => {
    setData((d) => ({ ...d, foods: d.foods.filter((f) => f.id !== id) }));
  }, []);

  const setSteps = useCallback((date: string, steps: number) => {
    setData((d) =>
      d.steps[date] === steps
        ? d
        : { ...d, steps: { ...d.steps, [date]: Math.max(0, Math.round(steps)) } }
    );
  }, []);

  const addWater = useCallback((ml: number, date: string = dateKey()) => {
    setData((d) => ({
      ...d,
      water: { ...d.water, [date]: Math.max(0, (d.water[date] ?? 0) + ml) },
    }));
  }, []);

  const logWeight = useCallback((kg: number, date: string = dateKey()) => {
    setData((d) => {
      const weights = [...d.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      const isLatest = weights[weights.length - 1].date === date;
      return {
        ...d,
        weights,
        profile: d.profile && isLatest ? { ...d.profile, weightKg: kg } : d.profile,
      };
    });
  }, []);

  const updateWorkout = useCallback(
    (date: string, sessionName: string, fn: (w: WorkoutLog) => WorkoutLog) => {
      setData((d) => {
        const prev = d.workouts[date];
        const cur: WorkoutLog =
          prev && prev.sessionName === sessionName
            ? prev
            : { date, sessionName, completed: [], finished: false };
        return { ...d, workouts: { ...d.workouts, [date]: fn(cur) } };
      });
    },
    []
  );

  const toggleExercise = useCallback(
    (date: string, sessionName: string, exerciseId: string) =>
      updateWorkout(date, sessionName, (w) => ({
        ...w,
        completed: w.completed.includes(exerciseId)
          ? w.completed.filter((x) => x !== exerciseId)
          : [...w.completed, exerciseId],
      })),
    [updateWorkout]
  );

  const setWorkoutFinished = useCallback(
    (date: string, sessionName: string, finished: boolean) =>
      updateWorkout(date, sessionName, (w) => ({ ...w, finished })),
    [updateWorkout]
  );

  const setAiKey = useCallback((key: string) => setData((d) => ({ ...d, aiKey: key.trim() })), []);

  const resetAll = useCallback(() => setData(EMPTY), []);

  const targets = useMemo(
    () => (data.profile ? computeTargets(data.profile) : null),
    [data.profile]
  );

  const value = useMemo<Store>(
    () => ({
      ready,
      data,
      targets,
      saveProfile,
      addFood,
      removeFood,
      setSteps,
      addWater,
      logWeight,
      toggleExercise,
      setWorkoutFinished,
      setAiKey,
      resetAll,
    }),
    [
      ready,
      data,
      targets,
      saveProfile,
      addFood,
      removeFood,
      setSteps,
      addWater,
      logWeight,
      toggleExercise,
      setWorkoutFinished,
      setAiKey,
      resetAll,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside AppStoreProvider");
  return s;
}

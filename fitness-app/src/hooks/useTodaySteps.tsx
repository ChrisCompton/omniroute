import { Pedometer } from "expo-sensors";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";

import { dateKey, startOfDay } from "@/lib/date";
import { useStore } from "@/store/AppStore";

export type StepSource = "loading" | "sensor" | "manual";

/**
 * Keeps today's step count in the store in sync with the phone's pedometer.
 * - iOS: reads the system step count for today (includes steps taken while the app was closed).
 * - Android: counts live while the app is open, added on top of what was already stored today.
 * - Web / no sensor / permission denied: falls back to manual entry.
 */
function useTodayStepsSync(): { steps: number; source: StepSource } {
  const { data, setSteps, ready } = useStore();
  const today = dateKey();
  const steps = data.steps[today] ?? 0;
  const [source, setSource] = useState<StepSource>("loading");
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    if (!ready) return;
    let sub: { remove: () => void } | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      try {
        if (Platform.OS === "web" || !(await Pedometer.isAvailableAsync())) {
          setSource("manual");
          return;
        }
        const perm = await Pedometer.requestPermissionsAsync();
        if (!perm.granted || cancelled) {
          setSource("manual");
          return;
        }
        setSource("sensor");

        if (Platform.OS === "ios") {
          const refresh = async () => {
            const r = await Pedometer.getStepCountAsync(startOfDay(), new Date());
            if (!cancelled) setSteps(dateKey(), Math.max(r.steps, stepsRef.current));
          };
          await refresh();
          interval = setInterval(() => void refresh(), 15000);
        } else {
          let base = stepsRef.current;
          let baseDay = dateKey();
          sub = Pedometer.watchStepCount((r) => {
            const day = dateKey();
            if (day !== baseDay) {
              // Midnight rolled over while the app was open.
              baseDay = day;
              base = -r.steps;
            }
            setSteps(day, base + r.steps);
          });
        }
      } catch (err) {
        console.warn("Pedometer unavailable", err);
        if (!cancelled) setSource("manual");
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
      if (interval) clearInterval(interval);
    };
  }, [ready, setSteps]);

  return { steps, source };
}

const StepsCtx = createContext<{ steps: number; source: StepSource }>({
  steps: 0,
  source: "loading",
});

/** Mount once (in the tab layout) so the pedometer keeps syncing whichever tab is open. */
export function StepsProvider({ children }: { children: ReactNode }) {
  const value = useTodayStepsSync();
  return <StepsCtx.Provider value={value}>{children}</StepsCtx.Provider>;
}

export function useTodaySteps(): { steps: number; source: StepSource } {
  return useContext(StepsCtx);
}

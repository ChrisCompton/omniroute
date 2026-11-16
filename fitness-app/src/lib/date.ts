export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date = new Date()): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** The last `n` days ending today, oldest first. */
export function lastNDays(n: number, today: Date = new Date()): Date[] {
  return Array.from({ length: n }, (_, i) => addDays(startOfDay(today), i - (n - 1)));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayShort(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

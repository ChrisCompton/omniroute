import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/theme";
import { Button, Card, Chip, styles } from "@/components/ui";
import { addDays, dateKey, startOfDay, weekdayShort } from "@/lib/date";
import { sessionMinutes, weeklyPlan } from "@/lib/workouts";
import { useStore } from "@/store/AppStore";

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);
  const m = Math.floor(Math.max(0, left) / 60);
  const s = String(Math.max(0, left) % 60).padStart(2, "0");
  return (
    <Card style={[styles.row, { borderColor: colors.accent, justifyContent: "space-between" }]}>
      <View style={styles.row}>
        <Ionicons name="timer-outline" size={22} color={colors.accent} />
        <Text style={[styles.text, { marginLeft: 8, fontWeight: "700", fontSize: 20 }]}>
          Rest {m}:{s}
        </Text>
      </View>
      <Pressable onPress={onDone} hitSlop={10}>
        <Text style={{ color: colors.accent, fontWeight: "700" }}>Skip</Text>
      </Pressable>
    </Card>
  );
}

export default function GymScreen() {
  const { data, toggleExercise, setWorkoutFinished } = useStore();
  const today = startOfDay();
  // Monday-first week containing today.
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [selected, setSelected] = useState(() => dateKey(today));
  const [rest, setRest] = useState<{ key: number; sec: number } | null>(null);
  const [openCue, setOpenCue] = useState<string | null>(null);

  const profile = data.profile;
  if (!profile) return null;
  const plan = weeklyPlan(profile);
  const selDate = week.find((d) => dateKey(d) === selected) ?? today;
  const day = plan[selDate.getDay()];
  const log = data.workouts[selected];
  const isToday = selected === dateKey(today);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.row, { justifyContent: "space-between", marginBottom: 16 }]}>
        {week.map((d) => {
          const k = dateKey(d);
          const p = plan[d.getDay()];
          const done = data.workouts[k]?.finished;
          const active = k === selected;
          return (
            <Pressable
              key={k}
              onPress={() => setSelected(k)}
              style={{
                alignItems: "center",
                padding: 6,
                borderRadius: 12,
                backgroundColor: active ? colors.cardAlt : "transparent",
                minWidth: 42,
              }}
            >
              <Text
                style={[
                  styles.muted,
                  { fontSize: 12, color: k === dateKey(today) ? colors.accent : colors.muted },
                ]}
              >
                {weekdayShort(d)}
              </Text>
              <Text style={[styles.text, { fontWeight: "700", marginVertical: 2 }]}>
                {d.getDate()}
              </Text>
              <Ionicons
                name={done ? "checkmark-circle" : p.type === "train" ? "barbell" : "bed-outline"}
                size={16}
                color={done ? colors.accent : p.type === "train" ? colors.text : colors.muted}
              />
            </Pressable>
          );
        })}
      </View>

      {rest ? <RestTimer key={rest.key} seconds={rest.sec} onDone={() => setRest(null)} /> : null}

      {day.type === "rest" ? (
        <Card style={{ alignItems: "center", paddingVertical: 32 }}>
          <Ionicons name="bed-outline" size={44} color={colors.muted} />
          <Text style={[styles.h1, { fontSize: 22, marginTop: 10 }]}>Rest day</Text>
          <Text style={[styles.muted, { textAlign: "center", marginTop: 6 }]}>
            {day.suggestion}
          </Text>
        </Card>
      ) : (
        <>
          <Text style={styles.h1}>{day.session.name}</Text>
          <Text style={[styles.muted, { marginBottom: 14 }]}>
            {day.session.focus} · ~{sessionMinutes(day.session)} min ·{" "}
            {profile.equipment === "home" ? "home version" : "gym"}
          </Text>

          <Card style={{ backgroundColor: colors.cardAlt }}>
            <Text style={[styles.text, { fontWeight: "700", marginBottom: 4 }]}>
              🔥 Warm-up (5–8 min)
            </Text>
            <Text style={styles.muted}>
              Light cardio, then 1–2 light sets of the first exercise before your working sets.
            </Text>
          </Card>

          {day.session.exercises.map((e, i) => {
            const done = log?.sessionName === day.session.name && log.completed.includes(e.id);
            return (
              <Card
                key={e.id}
                style={done ? { borderColor: colors.accentDim, opacity: 0.75 } : undefined}
              >
                <View style={styles.row}>
                  <Pressable
                    onPress={() => toggleExercise(selected, day.session.name, e.id)}
                    hitSlop={10}
                    accessibilityLabel={`Mark ${e.name} done`}
                  >
                    <Ionicons
                      name={done ? "checkmark-circle" : "ellipse-outline"}
                      size={28}
                      color={done ? colors.accent : colors.muted}
                    />
                  </Pressable>
                  <Pressable
                    style={{ flex: 1, marginLeft: 12 }}
                    onPress={() => setOpenCue(openCue === e.id ? null : e.id)}
                  >
                    <Text
                      style={[
                        styles.text,
                        { fontWeight: "700", textDecorationLine: done ? "line-through" : "none" },
                      ]}
                    >
                      {i + 1}. {e.name}
                    </Text>
                    <Text style={[styles.muted, { fontSize: 13 }]}>{e.muscle}</Text>
                  </Pressable>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.text, { fontWeight: "800", color: colors.accent }]}>
                      {e.sets} × {e.reps}
                    </Text>
                    <Pressable
                      onPress={() => setRest({ key: Date.now(), sec: e.restSec })}
                      hitSlop={6}
                    >
                      <Text style={[styles.muted, { fontSize: 12 }]}>⏱ rest {e.restSec}s</Text>
                    </Pressable>
                  </View>
                </View>
                {openCue === e.id ? (
                  <Text style={[styles.muted, { marginTop: 10, lineHeight: 20 }]}>💡 {e.cue}</Text>
                ) : null}
              </Card>
            );
          })}

          {day.session.cardio ? (
            <Card style={{ backgroundColor: colors.cardAlt }}>
              <Text style={[styles.text, { fontWeight: "700", marginBottom: 4 }]}>🏃 Cardio</Text>
              <Text style={styles.muted}>{day.session.cardio}</Text>
            </Card>
          ) : null}

          <Card style={{ backgroundColor: colors.cardAlt }}>
            <Text style={[styles.text, { fontWeight: "700", marginBottom: 4 }]}>
              📈 How to progress
            </Text>
            <Text style={[styles.muted, { lineHeight: 20 }]}>
              Pick a weight you could lift for 1–2 more reps than prescribed. When you hit the top
              of the rep range on every set, add a little weight (2.5 kg upper body, 5 kg lower
              body) next time.
            </Text>
          </Card>

          {log?.sessionName === day.session.name && log.finished ? (
            <Button
              title="Workout complete ✓ (undo)"
              variant="secondary"
              onPress={() => setWorkoutFinished(selected, day.session.name, false)}
            />
          ) : (
            <Button
              title={isToday ? "Finish workout" : "Mark as done"}
              icon="checkmark-done"
              onPress={() => setWorkoutFinished(selected, day.session.name, true)}
            />
          )}
        </>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 10 }]}>This week</Text>
      <View style={styles.chipWrap}>
        {week.map((d) => {
          const p = plan[d.getDay()];
          return (
            <Chip
              key={dateKey(d)}
              label={`${weekdayShort(d)}: ${p.type === "train" ? p.session.name : "Rest"}`}
              active={dateKey(d) === selected}
              onPress={() => setSelected(dateKey(d))}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/theme";
import { Button, Card, Ring, SectionTitle, Stat, styles } from "@/components/ui";
import { useTodaySteps } from "@/hooks/useTodaySteps";
import { stepsToKcal, stepsToMinutes } from "@/lib/calc";
import { dateKey, lastNDays, weekdayShort } from "@/lib/date";
import { useStore } from "@/store/AppStore";

export default function StepsScreen() {
  const { data, targets, setSteps } = useStore();
  const { steps, source } = useTodaySteps();
  const [manual, setManual] = useState("");
  if (!targets || !data.profile) return null;

  const goal = targets.steps;
  const left = Math.max(0, goal - steps);
  const days = lastNDays(7);
  const history = days.map((d) => ({ d, steps: data.steps[dateKey(d)] ?? 0 }));
  const max = Math.max(goal, ...history.map((h) => h.steps));
  const avg = Math.round(history.reduce((s, h) => s + h.steps, 0) / history.length);
  const hitDays = history.filter((h) => h.steps >= goal).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={{ alignItems: "center", paddingVertical: 24 }}>
        <Ring progress={steps / goal} size={200} stroke={16} color={colors.steps}>
          <Text style={{ color: colors.text, fontSize: 36, fontWeight: "800" }}>
            {steps.toLocaleString()}
          </Text>
          <Text style={styles.muted}>of {goal.toLocaleString()}</Text>
        </Ring>
        <Text style={[styles.text, { marginTop: 16, textAlign: "center" }]}>
          {left > 0
            ? `${left.toLocaleString()} to go — about a ${stepsToMinutes(left)} min brisk walk`
            : "Goal hit! 🎉"}
        </Text>
        <View style={[styles.row, { marginTop: 16 }]}>
          <Stat
            label="kcal burned"
            value={`~${stepsToKcal(steps, data.profile.weightKg)}`}
            color={colors.accent}
          />
          <Stat label="km" value={((steps * 0.75) / 1000).toFixed(1)} />
          <Stat label="7-day avg" value={avg.toLocaleString()} color={colors.steps} />
        </View>
      </Card>

      <Card>
        <SectionTitle right={<Text style={styles.muted}>{hitDays}/7 goals hit</Text>}>
          Last 7 days
        </SectionTitle>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            height: 140,
            justifyContent: "space-between",
          }}
        >
          {history.map(({ d, steps: s }) => (
            <View key={dateKey(d)} style={{ alignItems: "center", flex: 1 }}>
              <Text style={[styles.muted, { fontSize: 10, marginBottom: 4 }]}>
                {s >= 1000 ? `${(s / 1000).toFixed(1)}k` : s}
              </Text>
              <View
                style={{
                  width: 18,
                  height: Math.max(4, (s / max) * 100),
                  borderRadius: 6,
                  backgroundColor: s >= goal ? colors.steps : colors.cardAlt,
                }}
              />
              <Text style={[styles.muted, { fontSize: 11, marginTop: 6 }]}>{weekdayShort(d)}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>{source === "sensor" ? "Add steps manually" : "Log your steps"}</SectionTitle>
        <Text style={[styles.muted, { marginBottom: 10 }]}>
          {source === "sensor"
            ? "Counting automatically with your phone's motion sensor. Add steps from a watch or treadmill here."
            : source === "loading"
              ? "Connecting to your phone's step counter…"
              : "No step sensor available (or permission denied). Enter steps from your watch or phone health app."}
        </Text>
        <View style={[styles.row, { gap: 8 }]}>
          <TextInput
            value={manual}
            onChangeText={setManual}
            keyboardType="number-pad"
            placeholder="e.g. 2500"
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1 }]}
          />
          <Button
            title="Add"
            onPress={() => {
              const n = parseInt(manual, 10);
              if (n > 0) setSteps(dateKey(), steps + n);
              setManual("");
            }}
          />
          <Button
            title="Set"
            variant="secondary"
            onPress={() => {
              const n = parseInt(manual, 10);
              if (n >= 0) setSteps(dateKey(), n);
              setManual("");
            }}
          />
        </View>
      </Card>

      <Card style={{ backgroundColor: colors.cardAlt }}>
        <Text style={[styles.text, { fontWeight: "700", marginBottom: 6 }]}>
          Why {goal.toLocaleString()}?
        </Text>
        <Text style={[styles.muted, { lineHeight: 20 }]}>
          {data.profile.goal === "lose"
            ? "Walking is the easiest way to burn extra calories without hurting recovery from the gym. "
            : data.profile.goal === "gain"
              ? "Enough movement for heart health without eating into the surplus you need to build muscle. "
              : "A solid daily baseline for health and keeping body fat in check. "}
          {avg >= goal
            ? "You're averaging above goal — try adding 500–1,000 steps next week."
            : "Easy wins: walk during calls, take stairs, 10-min walk after each meal."}
        </Text>
      </Card>
    </ScrollView>
  );
}

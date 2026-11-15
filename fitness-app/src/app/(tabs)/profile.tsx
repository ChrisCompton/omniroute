import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/theme";
import { Button, Card, SectionTitle, Stat, styles } from "@/components/ui";
import { ACTIVITY_LABEL, bmi } from "@/lib/calc";
import { weightTrend } from "@/lib/coach";
import { useStore } from "@/store/AppStore";

const GOAL_LABEL = { lose: "Lose fat", maintain: "Maintain / tone", gain: "Build muscle" } as const;

export default function ProfileScreen() {
  const { data, targets, logWeight, resetAll } = useStore();
  const [w, setW] = useState("");
  const p = data.profile;
  if (!p || !targets) return null;

  const recent = [...data.weights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const trend = weightTrend(data.weights);

  const confirmReset = () => {
    const doIt = () => resetAll();
    if (Platform.OS === "web") {
      if (globalThis.confirm?.("Delete all your data and start over?")) doIt();
    } else {
      Alert.alert(
        "Start over?",
        "This deletes your profile and all logged food, steps and workouts.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete everything", style: "destructive", onPress: doIt },
        ]
      );
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h1}>{p.name || "You"}</Text>
      <Text style={[styles.muted, { marginBottom: 16 }]}>
        {GOAL_LABEL[p.goal]} · {p.daysPerWeek} days/week · {p.experience}
      </Text>

      <Card>
        <SectionTitle>Daily targets</SectionTitle>
        <View style={styles.row}>
          <Stat label="kcal" value={targets.kcal.toLocaleString()} color={colors.accent} />
          <Stat label="protein" value={`${targets.protein} g`} color={colors.protein} />
          <Stat label="carbs" value={`${targets.carbs} g`} color={colors.carbs} />
          <Stat label="fat" value={`${targets.fat} g`} color={colors.fat} />
        </View>
        <View style={[styles.row, { marginTop: 16 }]}>
          <Stat label="steps" value={targets.steps.toLocaleString()} color={colors.steps} />
          <Stat
            label="water"
            value={`${(targets.waterMl / 1000).toFixed(1)} L`}
            color={colors.water}
          />
          <Stat label="BMI" value={String(bmi(p))} />
          <Stat label="maintenance" value={targets.tdee.toLocaleString()} />
        </View>
      </Card>

      <Card>
        <SectionTitle
          right={
            trend !== null ? (
              <Text style={styles.muted}>
                {trend > 0 ? "+" : ""}
                {trend} kg / 2 wk
              </Text>
            ) : null
          }
        >
          Weight
        </SectionTitle>
        <View style={[styles.row, { gap: 8, marginBottom: 12 }]}>
          <TextInput
            value={w}
            onChangeText={setW}
            keyboardType="decimal-pad"
            placeholder={`${p.weightKg} kg`}
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1 }]}
          />
          <Button
            title="Log today"
            onPress={() => {
              const kg = parseFloat(w.replace(",", "."));
              if (kg >= 30 && kg <= 300) logWeight(kg);
              setW("");
            }}
          />
        </View>
        <Text style={[styles.muted, { fontSize: 12, marginBottom: 8 }]}>
          Weigh yourself in the morning, after the bathroom. Logging updates your calorie targets.
        </Text>
        {recent.map((r) => (
          <View
            key={r.date}
            style={[
              styles.row,
              {
                justifyContent: "space-between",
                paddingVertical: 6,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              },
            ]}
          >
            <Text style={styles.muted}>{r.date}</Text>
            <Text style={[styles.text, { fontWeight: "700" }]}>{r.kg} kg</Text>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle>Details</SectionTitle>
        {[
          ["Age", `${p.age}`],
          ["Height", `${p.heightCm} cm`],
          ["Weight", `${p.weightKg} kg`],
          ["Activity", ACTIVITY_LABEL[p.activity]],
          ["Training at", p.equipment === "gym" ? "Gym" : "Home"],
        ].map(([k, v]) => (
          <View
            key={k}
            style={[styles.row, { justifyContent: "space-between", paddingVertical: 6 }]}
          >
            <Text style={styles.muted}>{k}</Text>
            <Text style={[styles.text, { flexShrink: 1, textAlign: "right", marginLeft: 12 }]}>
              {v}
            </Text>
          </View>
        ))}
        <Button
          title="Edit profile & goals"
          variant="secondary"
          icon="create-outline"
          onPress={() => router.push("/edit-profile")}
          style={{ marginTop: 10 }}
        />
      </Card>

      <Text style={[styles.muted, { fontSize: 12, marginBottom: 12, lineHeight: 18 }]}>
        PocketCoach gives general fitness guidance, not medical advice. Check with a doctor before
        starting a new diet or training plan, especially if you have a health condition.
      </Text>
      <Button title="Reset all data" variant="danger" onPress={confirmReset} />
    </ScrollView>
  );
}

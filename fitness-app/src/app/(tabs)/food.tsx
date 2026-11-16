import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/theme";
import { Bar, Button, Card, SectionTitle, styles } from "@/components/ui";
import { sumMacros } from "@/lib/calc";
import { addDays, dateKey } from "@/lib/date";
import type { Meal } from "@/lib/types";
import { useStore } from "@/store/AppStore";

const MEALS: { key: Meal; label: string; icon: "sunny" | "partly-sunny" | "moon" | "cafe" }[] = [
  { key: "breakfast", label: "Breakfast", icon: "sunny" },
  { key: "lunch", label: "Lunch", icon: "partly-sunny" },
  { key: "dinner", label: "Dinner", icon: "moon" },
  { key: "snack", label: "Snacks", icon: "cafe" },
];

export default function FoodScreen() {
  const { data, targets, removeFood } = useStore();
  const [offset, setOffset] = useState(0);
  if (!targets) return null;

  const day = addDays(new Date(), offset);
  const key = dateKey(day);
  const entries = data.foods.filter((f) => f.date === key);
  const total = sumMacros(entries);
  const label =
    offset === 0
      ? "Today"
      : offset === -1
        ? "Yesterday"
        : day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.row, { justifyContent: "space-between", marginBottom: 14 }]}>
        <Pressable onPress={() => setOffset(offset - 1)} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.sectionTitle, { fontSize: 18 }]}>{label}</Text>
        <Pressable
          onPress={() => setOffset(Math.min(0, offset + 1))}
          hitSlop={10}
          disabled={offset === 0}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={offset === 0 ? colors.border : colors.text}
          />
        </Pressable>
      </View>

      <Card>
        <Bar
          label="Calories"
          value={total.kcal}
          target={targets.kcal}
          unit="kcal"
          color={total.kcal > targets.kcal ? colors.danger : colors.accent}
        />
        <Bar
          label="Protein"
          value={total.protein}
          target={targets.protein}
          color={colors.protein}
        />
        <Bar label="Carbs" value={total.carbs} target={targets.carbs} color={colors.carbs} />
        <Bar label="Fat" value={total.fat} target={targets.fat} color={colors.fat} />
      </Card>

      {MEALS.map((m) => {
        const items = entries.filter((e) => e.meal === m.key);
        const kcal = Math.round(items.reduce((s, e) => s + e.kcal, 0));
        return (
          <Card key={m.key}>
            <SectionTitle
              right={
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/add-food", params: { meal: m.key, date: key } })
                  }
                  hitSlop={10}
                  style={styles.row}
                >
                  <Text style={[styles.muted, { marginRight: 8 }]}>{kcal} kcal</Text>
                  <Ionicons name="add-circle" size={26} color={colors.accent} />
                </Pressable>
              }
            >
              {m.label}
            </SectionTitle>
            {items.length === 0 ? <Text style={styles.muted}>Nothing yet</Text> : null}
            {items.map((e) => (
              <View
                key={e.id}
                style={[
                  styles.row,
                  { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.text}>{e.name}</Text>
                  <Text style={[styles.muted, { fontSize: 12 }]}>
                    {e.servings !== 1 ? `${e.servings} × ` : ""}
                    {e.serving} · P {Math.round(e.protein)} · C {Math.round(e.carbs)} · F{" "}
                    {Math.round(e.fat)}
                  </Text>
                </View>
                <Text style={[styles.text, { fontWeight: "700", marginRight: 12 }]}>
                  {Math.round(e.kcal)}
                </Text>
                <Pressable
                  onPress={() => removeFood(e.id)}
                  hitSlop={10}
                  accessibilityLabel={`Remove ${e.name}`}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </Card>
        );
      })}

      <Button
        title="Describe a meal to AI"
        icon="chatbubbles"
        variant="secondary"
        onPress={() => router.push("/chat")}
        style={{ marginBottom: 10 }}
      />
      <Button
        title="Add food"
        icon="add"
        onPress={() => router.push({ pathname: "/add-food", params: { date: key } })}
      />
    </ScrollView>
  );
}

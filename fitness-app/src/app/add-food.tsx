import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "@/components/theme";
import { Button, Card, Chip, Field, styles } from "@/components/ui";
import { dateKey } from "@/lib/date";
import { FOOD_CATEGORIES, searchFoods } from "@/lib/foods";
import type { FoodItem, Macros, Meal } from "@/lib/types";
import { useStore } from "@/store/AppStore";

const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

function defaultMeal(): Meal {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

function scale(m: Macros, x: number): Macros {
  const r = (n: number) => Math.round(n * x * 10) / 10;
  return { kcal: Math.round(m.kcal * x), protein: r(m.protein), carbs: r(m.carbs), fat: r(m.fat) };
}

function num(s: string): number {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function AddFood() {
  const params = useLocalSearchParams<{ meal?: Meal; date?: string }>();
  const { data, addFood } = useStore();
  const [meal, setMeal] = useState<Meal>(
    params.meal && MEALS.includes(params.meal) ? params.meal : defaultMeal()
  );
  const date = params.date ?? dateKey();
  const [mode, setMode] = useState<"search" | "custom">("search");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [servings, setServings] = useState("1");

  // custom entry
  const [cName, setCName] = useState("");
  const [cKcal, setCKcal] = useState("");
  const [cP, setCP] = useState("");
  const [cC, setCC] = useState("");
  const [cF, setCF] = useState("");

  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: FoodItem[] = [];
    for (const f of [...data.foods].sort((a, b) => b.createdAt - a.createdAt)) {
      if (seen.has(f.name) || out.length >= 6) continue;
      seen.add(f.name);
      const per = f.servings || 1;
      out.push({
        id: `recent:${f.name}`,
        name: f.name,
        serving: f.serving,
        category: "Recent",
        ...scale(f, 1 / per),
      });
    }
    return out;
  }, [data.foods]);

  const results =
    query || category ? searchFoods(query, category) : recent.length ? recent : searchFoods("");

  const save = (name: string, serving: string, macros: Macros, n: number) => {
    addFood({ date, meal, name, serving, servings: n, ...scale(macros, n) });
    router.back();
  };

  const mealPicker = (
    <View style={[styles.chipWrap, { marginBottom: 8 }]}>
      {MEALS.map((m) => (
        <Chip
          key={m}
          label={m[0].toUpperCase() + m.slice(1)}
          active={meal === m}
          onPress={() => setMeal(m)}
        />
      ))}
    </View>
  );

  if (selected) {
    const n = num(servings);
    const preview = scale(selected, n);
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.h1, { fontSize: 22 }]}>{selected.name}</Text>
        <Text style={[styles.muted, { marginBottom: 16 }]}>
          Per {selected.serving}: {selected.kcal} kcal
        </Text>
        {mealPicker}
        <Card>
          <Text style={styles.fieldLabel}>Servings</Text>
          <View style={[styles.row, { gap: 8, marginBottom: 12 }]}>
            {["0.5", "1", "1.5", "2", "3"].map((s) => (
              <Chip key={s} label={s} active={servings === s} onPress={() => setServings(s)} />
            ))}
          </View>
          <TextInput
            value={servings}
            onChangeText={setServings}
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </Card>
        <Card>
          <View style={styles.row}>
            {(
              [
                ["kcal", preview.kcal, colors.accent],
                ["protein", preview.protein, colors.protein],
                ["carbs", preview.carbs, colors.carbs],
                ["fat", preview.fat, colors.fat],
              ] as const
            ).map(([l, v, c]) => (
              <View key={l} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ color: c, fontSize: 20, fontWeight: "800" }}>{v}</Text>
                <Text style={[styles.muted, { fontSize: 12 }]}>{l === "kcal" ? l : `${l} g`}</Text>
              </View>
            ))}
          </View>
        </Card>
        <Button
          title={`Add to ${meal}`}
          disabled={n <= 0}
          onPress={() => save(selected.name, selected.serving, selected, n)}
        />
        <Button
          title="Back to search"
          variant="ghost"
          onPress={() => setSelected(null)}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ padding: 16, paddingBottom: 0 }}>
        {mealPicker}
        <View style={[styles.row, { gap: 8, marginBottom: 12 }]}>
          <Chip label="Search foods" active={mode === "search"} onPress={() => setMode("search")} />
          <Chip
            label="Quick add kcal"
            active={mode === "custom"}
            onPress={() => setMode("custom")}
          />
        </View>
      </View>

      {mode === "custom" ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <Field
              label="Name"
              value={cName}
              onChangeText={setCName}
              placeholder="e.g. Mum's lasagne"
            />
            <Field
              label="Calories (kcal)"
              value={cKcal}
              onChangeText={setCKcal}
              keyboardType="number-pad"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Protein g"
                  value={cP}
                  onChangeText={setCP}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Carbs g"
                  value={cC}
                  onChangeText={setCC}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Fat g"
                  value={cF}
                  onChangeText={setCF}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
            </View>
          </Card>
          <Button
            title={`Add to ${meal}`}
            disabled={num(cKcal) <= 0}
            onPress={() =>
              save(
                cName.trim() || "Quick add",
                "1 serving",
                { kcal: num(cKcal), protein: num(cP), carbs: num(cC), fat: num(cF) },
                1
              )
            }
          />
        </ScrollView>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={[styles.input, styles.row, { paddingVertical: 0 }]}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search e.g. chicken, banana, pizza"
                placeholderTextColor={colors.muted}
                style={{
                  flex: 1,
                  color: colors.text,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  fontSize: 16,
                }}
                autoFocus
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 10, flexGrow: 0 }}
            >
              <Chip label="All" active={!category} onPress={() => setCategory(undefined)} />
              {FOOD_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={category === c}
                  onPress={() => setCategory(category === c ? undefined : c)}
                />
              ))}
            </ScrollView>
            {!query && !category && recent.length ? (
              <Text style={[styles.fieldLabel, { marginTop: 6 }]}>RECENT</Text>
            ) : null}
          </View>
          <FlatList
            data={results}
            keyExtractor={(f) => f.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingTop: 4 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", marginTop: 24 }}>
                <Text style={styles.muted}>No match for “{query}”.</Text>
                <Button
                  title="Add it manually"
                  variant="secondary"
                  onPress={() => {
                    setCName(query);
                    setMode("custom");
                  }}
                  style={{ marginTop: 12 }}
                />
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSelected(item);
                  setServings("1");
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.text}>{item.name}</Text>
                  <Text style={[styles.muted, { fontSize: 12 }]}>
                    {item.serving} · P {item.protein} · C {item.carbs} · F {item.fat}
                  </Text>
                </View>
                <Text style={[styles.text, { fontWeight: "700" }]}>{item.kcal}</Text>
                <Text style={[styles.muted, { fontSize: 12, marginLeft: 4 }]}>kcal</Text>
              </Pressable>
            )}
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/theme";
import { Bar, Button, Card, Ring, SectionTitle, Stat, styles } from "@/components/ui";
import { useTodaySteps } from "@/hooks/useTodaySteps";
import { stepsToKcal, sumMacros } from "@/lib/calc";
import { coachTips } from "@/lib/coach";
import { dateKey, greeting } from "@/lib/date";
import { planForDate, sessionMinutes } from "@/lib/workouts";
import { useStore } from "@/store/AppStore";

export default function CoachScreen() {
  const { data, targets, addWater } = useStore();
  const { steps } = useTodaySteps();
  const profile = data.profile;
  if (!profile || !targets) return null;

  const today = dateKey();
  const eaten = sumMacros(data.foods.filter((f) => f.date === today));
  const water = data.water[today] ?? 0;
  const plan = planForDate(profile);
  const workout = data.workouts[today];
  const finished =
    plan.type === "train" && workout?.sessionName === plan.session.name && workout.finished;
  const kcalLeft = targets.kcal - eaten.kcal;
  const tips = coachTips({
    profile,
    targets,
    eaten,
    steps,
    waterMl: water,
    plan,
    workoutFinished: finished,
    weights: data.weights,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>
        {greeting()}
        {profile.name ? `, ${profile.name}` : ""}
      </Text>
      <Text style={[styles.muted, { marginBottom: 18, marginTop: 4 }]}>
        Here's what I want from you today.
      </Text>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ring progress={eaten.kcal / targets.kcal} size={140}>
            <Text
              style={{
                color: kcalLeft < 0 ? colors.danger : colors.text,
                fontSize: 26,
                fontWeight: "800",
              }}
            >
              {Math.abs(Math.round(kcalLeft))}
            </Text>
            <Text style={[styles.muted, { fontSize: 12 }]}>
              {kcalLeft < 0 ? "kcal over" : "kcal left"}
            </Text>
          </Ring>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Bar
              label="Protein"
              value={eaten.protein}
              target={targets.protein}
              color={colors.protein}
            />
            <Bar label="Carbs" value={eaten.carbs} target={targets.carbs} color={colors.carbs} />
            <Bar label="Fat" value={eaten.fat} target={targets.fat} color={colors.fat} />
          </View>
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <Stat label="target" value={targets.kcal.toLocaleString()} />
          <Stat
            label="eaten"
            value={Math.round(eaten.kcal).toLocaleString()}
            color={colors.accent}
          />
          <Stat
            label="walked off"
            value={`~${stepsToKcal(steps, profile.weightKg)}`}
            color={colors.steps}
          />
        </View>
        <Button
          title="Log food"
          icon="add"
          onPress={() => router.push("/add-food")}
          style={{ marginTop: 14 }}
        />
      </Card>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable style={{ flex: 1 }} onPress={() => router.push("/steps")}>
          <Card style={{ alignItems: "center" }}>
            <Ring progress={steps / targets.steps} size={96} stroke={10} color={colors.steps}>
              <Ionicons name="walk" size={26} color={colors.steps} />
            </Ring>
            <Text style={[styles.text, { fontWeight: "700", marginTop: 8 }]}>
              {steps.toLocaleString()}
            </Text>
            <Text style={[styles.muted, { fontSize: 12 }]}>
              of {targets.steps.toLocaleString()} steps
            </Text>
          </Card>
        </Pressable>
        <Card style={{ flex: 1, alignItems: "center" }}>
          <Ring progress={water / targets.waterMl} size={96} stroke={10} color={colors.water}>
            <Ionicons name="water" size={26} color={colors.water} />
          </Ring>
          <Text style={[styles.text, { fontWeight: "700", marginTop: 8 }]}>
            {(water / 1000).toFixed(2)} L
          </Text>
          <Pressable onPress={() => addWater(250)} hitSlop={8}>
            <Text style={{ color: colors.water, fontSize: 12, fontWeight: "700" }}>
              + 250 ml glass
            </Text>
          </Pressable>
        </Card>
      </View>

      <Pressable onPress={() => router.push("/gym")}>
        <Card>
          <SectionTitle right={<Ionicons name="chevron-forward" size={18} color={colors.muted} />}>
            Today's training
          </SectionTitle>
          {plan.type === "train" ? (
            <>
              <Text style={[styles.text, { fontSize: 18, fontWeight: "700" }]}>
                {finished ? "✅ " : ""}
                {plan.session.name}
              </Text>
              <Text style={styles.muted}>
                {plan.session.focus} · {plan.session.exercises.length} exercises · ~
                {sessionMinutes(plan.session)} min
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.text, { fontSize: 18, fontWeight: "700" }]}>Rest & recover</Text>
              <Text style={styles.muted}>{plan.suggestion}</Text>
            </>
          )}
        </Card>
      </Pressable>

      <SectionTitle>Coach says</SectionTitle>
      {tips.map((t) => (
        <Card key={t.id} style={{ flexDirection: "row" }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.cardAlt,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name={t.icon} size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.text, { fontWeight: "700", marginBottom: 2 }]}>{t.title}</Text>
            <Text style={[styles.muted, { lineHeight: 20 }]}>{t.body}</Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

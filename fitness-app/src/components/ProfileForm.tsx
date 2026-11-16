import { useState } from "react";
import { Text, View } from "react-native";

import { ACTIVITY_LABEL, computeTargets } from "@/lib/calc";
import type { ActivityLevel, Equipment, Experience, Goal, Profile, Sex } from "@/lib/types";

import { Button, Card, Choice, Field, Stat, styles } from "./ui";
import { colors } from "./theme";

const DEFAULT: Profile = {
  name: "",
  sex: "male",
  age: 25,
  heightCm: 175,
  weightKg: 75,
  activity: "light",
  goal: "lose",
  experience: "beginner",
  daysPerWeek: 3,
  equipment: "gym",
};

function num(s: string): number {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Profile | null;
  submitLabel: string;
  onSubmit: (p: Profile) => void;
}) {
  const start = initial ?? DEFAULT;
  const [name, setName] = useState(start.name);
  const [sex, setSex] = useState<Sex>(start.sex);
  const [age, setAge] = useState(String(start.age));
  const [height, setHeight] = useState(String(start.heightCm));
  const [weight, setWeight] = useState(String(start.weightKg));
  const [activity, setActivity] = useState<ActivityLevel>(start.activity);
  const [goal, setGoal] = useState<Goal>(start.goal);
  const [experience, setExperience] = useState<Experience>(start.experience);
  const [days, setDays] = useState<number>(start.daysPerWeek);
  const [equipment, setEquipment] = useState<Equipment>(start.equipment);

  const profile: Profile = {
    name: name.trim(),
    sex,
    age: Math.round(num(age)),
    heightCm: num(height),
    weightKg: num(weight),
    activity,
    goal,
    experience,
    daysPerWeek: days,
    equipment,
  };
  const valid =
    profile.age >= 13 &&
    profile.age <= 100 &&
    profile.heightCm >= 120 &&
    profile.heightCm <= 230 &&
    profile.weightKg >= 30 &&
    profile.weightKg <= 300;
  const t = valid ? computeTargets(profile) : null;

  return (
    <View>
      <Card>
        <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Alex" />
        <Choice
          label="Sex (for calorie maths)"
          value={sex}
          onChange={setSex}
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Height (cm)"
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Weight (kg)"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      </Card>

      <Card>
        <Choice
          label="Main goal"
          value={goal}
          onChange={setGoal}
          options={[
            { value: "lose", label: "Lose fat" },
            { value: "maintain", label: "Maintain / tone" },
            { value: "gain", label: "Build muscle" },
          ]}
        />
        <Choice
          label="Activity level (outside the gym)"
          value={activity}
          onChange={setActivity}
          options={(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((a) => ({
            value: a,
            label: ACTIVITY_LABEL[a].split(" (")[0],
          }))}
        />
        <Text style={[styles.muted, { marginTop: -6, marginBottom: 14, fontSize: 12 }]}>
          {ACTIVITY_LABEL[activity]}
        </Text>
      </Card>

      <Card>
        <Choice
          label="Gym experience"
          value={experience}
          onChange={setExperience}
          options={[
            { value: "beginner", label: "Beginner" },
            { value: "intermediate", label: "Intermediate" },
            { value: "advanced", label: "Advanced" },
          ]}
        />
        <Choice
          label="Training days per week"
          value={days}
          onChange={setDays}
          options={[2, 3, 4, 5, 6].map((d) => ({ value: d, label: `${d}` }))}
        />
        <Choice
          label="Where do you train?"
          value={equipment}
          onChange={setEquipment}
          options={[
            { value: "gym", label: "Gym" },
            { value: "home", label: "Home / no equipment" },
          ]}
        />
      </Card>

      {t ? (
        <Card style={{ borderColor: colors.accentDim }}>
          <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Your daily plan</Text>
          <View style={styles.row}>
            <Stat label="kcal" value={t.kcal.toLocaleString()} color={colors.accent} />
            <Stat label="protein" value={`${t.protein} g`} color={colors.protein} />
            <Stat label="steps" value={t.steps.toLocaleString()} color={colors.steps} />
          </View>
          <Text style={[styles.muted, { marginTop: 12, fontSize: 12 }]}>
            Maintenance is ~{t.tdee.toLocaleString()} kcal (BMR {t.bmr.toLocaleString()}).
            {goal === "lose"
              ? " A 500 kcal deficit ≈ 0.5 kg/week."
              : goal === "gain"
                ? " A small 300 kcal surplus keeps fat gain low."
                : ""}
          </Text>
        </Card>
      ) : (
        <Text style={[styles.muted, { marginBottom: 14 }]}>
          Enter a valid age, height and weight to see your plan.
        </Text>
      )}

      <Button title={submitLabel} disabled={!valid} onPress={() => onSubmit(profile)} />
    </View>
  );
}

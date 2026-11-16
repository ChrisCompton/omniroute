import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "expo-router";
import { useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";

import { colors } from "@/components/theme";
import { Card, styles } from "@/components/ui";
import { useTodaySteps } from "@/hooks/useTodaySteps";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import {
  AI_PROXY_URL,
  AiError,
  askCoach,
  formVideoUrl,
  type ChatHistory,
  type CoachReply,
  type ExerciseTip,
} from "@/lib/ai";
import { addDays, dateKey, startOfDay } from "@/lib/date";
import { sumMacros } from "@/lib/calc";
import type { AppData, Macros } from "@/lib/types";
import { planForDate } from "@/lib/workouts";
import { useStore } from "@/store/AppStore";

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  reply?: CoachReply;
  /** Ids of food entries this reply added (null once undone). */
  foodIds?: string[] | null;
  /** Id of the workout this reply logged (null once undone). */
  workoutId?: string | null;
  /** Whether logging the workout ticked off today's planned session. */
  markedPlanDone?: boolean;
}

const STARTERS = [
  { icon: "restaurant" as const, text: "I just had a chicken wrap and chips for lunch" },
  { icon: "barbell" as const, text: "Just did back day: pull-ups 3x8, rows 3x10 at 60 kg" },
  { icon: "help-circle" as const, text: "What's a good back exercise?" },
  { icon: "stats-chart" as const, text: "How am I doing today?" },
];

const ROUND_BUTTON = {
  width: 46,
  height: 46,
  borderRadius: 23,
  backgroundColor: colors.accent,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

/** Days this week (Mon-Sun) with a finished planned session or an AI-logged workout. */
function workoutsThisWeek(data: AppData, today: Date = new Date()): number {
  const monday = addDays(startOfDay(today), -((today.getDay() + 6) % 7));
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const k = dateKey(addDays(monday, i));
    if (data.workouts[k]?.finished || data.activities.some((a) => a.date === k)) count++;
  }
  return count;
}

function totals(items: Macros[]): Macros {
  return items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function ExerciseCard({ ex }: { ex: ExerciseTip }) {
  return (
    <View style={{ backgroundColor: colors.cardAlt, borderRadius: 12, padding: 12, marginTop: 8 }}>
      <View style={[styles.row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.text, { fontWeight: "800" }]}>{ex.name}</Text>
          <Text style={[styles.muted, { fontSize: 12 }]}>{ex.muscle}</Text>
        </View>
        <Text style={{ color: colors.accent, fontWeight: "800" }}>{ex.setsReps}</Text>
      </View>
      {ex.steps.map((s, i) => (
        <Text key={i} style={[styles.muted, { marginTop: 6, lineHeight: 19 }]}>
          {i + 1}. {s}
        </Text>
      ))}
      <Pressable
        onPress={() => void Linking.openURL(formVideoUrl(ex.name))}
        style={[styles.row, { marginTop: 10, alignSelf: "flex-start" }]}
        hitSlop={8}
      >
        <Ionicons name="play-circle" size={20} color={colors.accent} />
        <Text style={{ color: colors.accent, fontWeight: "700", marginLeft: 6 }}>Watch how</Text>
      </Pressable>
    </View>
  );
}

function LoggedBadge({
  label,
  undone,
  onUndo,
}: {
  label: string;
  undone: boolean;
  onUndo: () => void;
}) {
  return (
    <View style={[styles.row, { justifyContent: "space-between", marginTop: 10 }]}>
      <View style={styles.row}>
        <Ionicons
          name={undone ? "close-circle" : "checkmark-circle"}
          size={18}
          color={undone ? colors.muted : colors.accent}
        />
        <Text
          style={{ color: undone ? colors.muted : colors.accent, fontWeight: "700", marginLeft: 6 }}
        >
          {undone ? "Removed" : label}
        </Text>
      </View>
      {!undone ? (
        <Pressable onPress={onUndo} hitSlop={10}>
          <Text style={{ color: colors.muted, fontWeight: "700" }}>Undo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ChatScreen() {
  const { data, targets, addFood, removeFood, addActivity, removeActivity, setWorkoutFinished } =
    useStore();
  const { steps } = useTodaySteps();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [history, setHistory] = useState<ChatHistory>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const sendRef = useRef<(text: string) => void>(() => {});
  const voice = useVoiceInput((text) => sendRef.current(text));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => {
            setMessages([]);
            setHistory([]);
            setError(null);
          }}
          hitSlop={10}
          accessibilityLabel="New chat"
          style={{ marginRight: 16 }}
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation]);

  if (!data.profile || !targets) return null;
  const profile = data.profile;

  if (!AI_PROXY_URL) {
    return (
      <View
        style={[styles.screen, styles.content, { alignItems: "center", justifyContent: "center" }]}
      >
        <Ionicons name="chatbubbles-outline" size={48} color={colors.muted} />
        <Text style={[styles.h1, { fontSize: 22, marginTop: 10, textAlign: "center" }]}>
          AI coach coming soon
        </Text>
        <Text style={[styles.muted, { textAlign: "center", marginTop: 6 }]}>
          Meanwhile, you can log food from the Food tab.
        </Text>
      </View>
    );
  }

  const today = dateKey();
  const todaysPlan = planForDate(profile);
  const planDone =
    todaysPlan.type === "train" &&
    data.workouts[today]?.sessionName === todaysPlan.session.name &&
    !!data.workouts[today]?.finished;
  const eatenToday = sumMacros(data.foods.filter((f) => f.date === today));

  /** Add what the AI logged to the user's day. */
  const applyReply = (
    reply: CoachReply
  ): Pick<UiMessage, "foodIds" | "workoutId" | "markedPlanDone"> => {
    const out: Pick<UiMessage, "foodIds" | "workoutId" | "markedPlanDone"> = {};
    if (reply.foodItems.length) {
      out.foodIds = reply.foodItems.map((i) =>
        addFood({
          date: today,
          meal: reply.meal,
          name: i.name,
          serving: i.portion,
          servings: 1,
          kcal: i.kcal,
          protein: i.protein,
          carbs: i.carbs,
          fat: i.fat,
        })
      );
    }
    if (reply.workout) {
      out.workoutId = addActivity({ date: today, ...reply.workout });
      if (todaysPlan.type === "train" && !planDone) {
        setWorkoutFinished(today, todaysPlan.session.name, true);
        out.markedPlanDone = true;
      }
    }
    return out;
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const userMsg: UiMessage = { id: `u${Date.now()}`, role: "user", text: content };
    const nextHistory: ChatHistory = [...history, { role: "user", content }];
    setMessages((m) => [...m, userMsg]);
    setHistory(nextHistory);
    setInput("");
    setError(null);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const { reply, assistantTurn } = await askCoach(nextHistory, {
        profile,
        targets,
        eatenToday,
        steps,
        plan: todaysPlan,
        planDone,
        workoutsThisWeek: workoutsThisWeek(data),
      });
      setHistory([...nextHistory, assistantTurn]);
      const logged = applyReply(reply);
      setMessages((m) => [
        ...m,
        { id: `a${Date.now()}`, role: "assistant", text: reply.message, reply, ...logged },
      ]);
    } catch (err) {
      // Roll back the unanswered turn so the user can retry.
      setHistory(history);
      setMessages((m) => m.filter((x) => x.id !== userMsg.id));
      setInput(content);
      setError(err instanceof AiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };
  sendRef.current = (t: string) => void send(t);

  const undoFood = (msg: UiMessage) => {
    msg.foodIds?.forEach(removeFood);
    setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, foodIds: null } : x)));
  };
  const undoWorkout = (msg: UiMessage) => {
    if (msg.workoutId) removeActivity(msg.workoutId);
    if (msg.markedPlanDone && todaysPlan.type === "train") {
      setWorkoutFinished(today, todaysPlan.session.name, false);
    }
    setMessages((m) =>
      m.map((x) => (x.id === msg.id ? { ...x, workoutId: null, markedPlanDone: false } : x))
    );
  };

  const last = messages[messages.length - 1];
  const quickOptions = !busy && last?.role === "assistant" && last.reply ? last.reply.options : [];
  const kcalLeft = Math.round(targets.kcal - eatenToday.kcal);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={{ marginTop: 8 }}>
            <Text style={[styles.h1, { fontSize: 24 }]}>Your AI coach 💪</Text>
            <Text style={[styles.muted, { marginTop: 6, marginBottom: 16, lineHeight: 20 }]}>
              Tell me what you ate or how your workout went, by typing or with a voice note, and
              I'll log it for you. You can also ask me anything about training or food.
            </Text>
            {STARTERS.map((s) => (
              <Pressable
                key={s.text}
                onPress={() => void send(s.text)}
                style={({ pressed }) => [
                  styles.card,
                  styles.row,
                  { paddingVertical: 12, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons
                  name={s.icon}
                  size={18}
                  color={colors.accent}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.text, { flex: 1 }]}>{s.text}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {messages.map((m) => {
          const r = m.reply;
          const wide = !!r && (r.foodItems.length > 0 || !!r.workout || r.exercises.length > 0);
          const foodTotal = r ? totals(r.foodItems) : null;
          return (
            <View
              key={m.id}
              style={{
                alignItems: m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  maxWidth: wide ? "100%" : "85%",
                  width: wide ? "100%" : undefined,
                  backgroundColor: m.role === "user" ? colors.accent : colors.card,
                  borderRadius: 16,
                  borderBottomRightRadius: m.role === "user" ? 4 : 16,
                  borderBottomLeftRadius: m.role === "user" ? 16 : 4,
                  padding: 12,
                  borderWidth: m.role === "user" ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                {m.text ? (
                  <Text
                    style={{
                      color: m.role === "user" ? "#06210F" : colors.text,
                      fontSize: 15,
                      lineHeight: 21,
                    }}
                  >
                    {m.text}
                  </Text>
                ) : null}

                {r && r.foodItems.length > 0 && foodTotal ? (
                  <View
                    style={{
                      backgroundColor: colors.cardAlt,
                      borderRadius: 12,
                      padding: 12,
                      marginTop: 10,
                    }}
                  >
                    {r.foodItems.map((i, idx) => (
                      <View key={idx} style={[styles.row, { paddingVertical: 4 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.text}>{i.name}</Text>
                          <Text style={[styles.muted, { fontSize: 12 }]}>
                            {i.portion} · P {i.protein} · C {i.carbs} · F {i.fat}
                          </Text>
                        </View>
                        <Text style={[styles.text, { fontWeight: "700" }]}>{i.kcal}</Text>
                      </View>
                    ))}
                    <View
                      style={[
                        styles.row,
                        {
                          justifyContent: "space-between",
                          marginTop: 8,
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                          paddingTop: 8,
                        },
                      ]}
                    >
                      <Text style={[styles.text, { fontWeight: "800" }]}>Total</Text>
                      <Text style={{ color: colors.accent, fontWeight: "800" }}>
                        {Math.round(foodTotal.kcal)} kcal · {Math.round(foodTotal.protein)} g
                        protein
                      </Text>
                    </View>
                    <LoggedBadge
                      label={`Added to ${r.meal}`}
                      undone={m.foodIds === null}
                      onUndo={() => undoFood(m)}
                    />
                  </View>
                ) : null}

                {r?.workout ? (
                  <View
                    style={{
                      backgroundColor: colors.cardAlt,
                      borderRadius: 12,
                      padding: 12,
                      marginTop: 10,
                    }}
                  >
                    <View style={[styles.row, { marginBottom: 6 }]}>
                      <Ionicons name="barbell" size={18} color={colors.accent} />
                      <Text style={[styles.text, { fontWeight: "800", marginLeft: 8, flex: 1 }]}>
                        {r.workout.title}
                      </Text>
                      {r.workout.kcalBurned > 0 ? (
                        <Text style={[styles.muted, { fontSize: 12 }]}>
                          ~{r.workout.kcalBurned} kcal
                        </Text>
                      ) : null}
                    </View>
                    {r.workout.strength.map((s, idx) => (
                      <Text key={`s${idx}`} style={[styles.muted, { lineHeight: 20 }]}>
                        • {s.name}: {s.sets}×{s.reps}
                        {s.weightKg ? ` @ ${s.weightKg} kg` : ""}
                      </Text>
                    ))}
                    {r.workout.cardio.map((c, idx) => (
                      <Text key={`c${idx}`} style={[styles.muted, { lineHeight: 20 }]}>
                        • {c.activity}: {c.minutes} min
                      </Text>
                    ))}
                    <LoggedBadge
                      label="Workout logged"
                      undone={m.workoutId === null}
                      onUndo={() => undoWorkout(m)}
                    />
                  </View>
                ) : null}

                {r?.exercises.map((ex, idx) => (
                  <ExerciseCard key={idx} ex={ex} />
                ))}
              </View>
            </View>
          );
        })}

        {busy ? (
          <View style={[styles.row, { marginBottom: 10 }]}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.muted, { marginLeft: 8 }]}>Thinking…</Text>
          </View>
        ) : null}

        {quickOptions.length ? (
          <View style={styles.chipWrap}>
            {quickOptions.map((o) => (
              <Pressable key={o} onPress={() => void send(o)} style={styles.chip}>
                <Text style={styles.chipText}>{o}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {error || voice.error ? (
          <Card style={{ borderColor: colors.danger, marginTop: 8 }}>
            <Text style={{ color: colors.danger }}>{error ?? voice.error}</Text>
          </Card>
        ) : null}
      </ScrollView>

      {messages.length > 0 ? (
        <View style={[styles.row, { justifyContent: "center", paddingBottom: 6 }]}>
          <Text style={[styles.muted, { fontSize: 12 }]}>
            Today: {kcalLeft >= 0 ? `${kcalLeft} kcal left` : `${-kcalLeft} kcal over`} ·{" "}
            {Math.max(0, Math.round(targets.protein - eatenToday.protein))} g protein to go
          </Text>
        </View>
      ) : null}

      {voice.listening ? (
        <View
          style={[
            styles.row,
            {
              padding: 12,
              gap: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Pressable onPress={voice.cancel} hitSlop={10} accessibilityLabel="Cancel voice note">
            <Ionicons name="close" size={24} color={colors.muted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 12 }}>
              ● Listening…
            </Text>
            <Text style={[styles.text, { marginTop: 2 }]} numberOfLines={3}>
              {voice.transcript || "Say what you ate or how your workout went"}
            </Text>
          </View>
          <Pressable onPress={voice.stop} style={ROUND_BUTTON} accessibilityLabel="Send voice note">
            <Ionicons name="arrow-up" size={22} color="#06210F" />
          </Pressable>
        </View>
      ) : (
        <View
          style={[
            styles.row,
            {
              padding: 12,
              gap: 8,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.bg,
            },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={voice.supported ? "Type or tap the mic…" : "Type a message…"}
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1 }]}
            onSubmitEditing={() => void send(input)}
            returnKeyType="send"
            editable={!busy}
          />
          {voice.supported && !input.trim() ? (
            <Pressable
              onPress={voice.start}
              disabled={busy}
              style={[ROUND_BUTTON, { opacity: busy ? 0.4 : 1 }]}
              accessibilityLabel="Record a voice note"
            >
              <Ionicons name="mic" size={22} color="#06210F" />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void send(input)}
              disabled={busy || !input.trim()}
              style={[ROUND_BUTTON, { opacity: busy || !input.trim() ? 0.4 : 1 }]}
              accessibilityLabel="Send"
            >
              <Ionicons name="arrow-up" size={22} color="#06210F" />
            </Pressable>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

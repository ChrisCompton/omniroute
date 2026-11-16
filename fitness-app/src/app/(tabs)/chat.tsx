import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "expo-router";
import { useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";

import { colors } from "@/components/theme";
import { Button, Card, Chip, styles } from "@/components/ui";
import { AI_PROXY_URL, AiError, askCoach, type ChatHistory, type CoachReply } from "@/lib/ai";
import { sumMacros } from "@/lib/calc";
import { dateKey } from "@/lib/date";
import type { Meal } from "@/lib/types";
import { useStore } from "@/store/AppStore";

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  reply?: CoachReply;
}

const STARTERS = [
  "I had a chicken burrito for lunch",
  "2 eggs on toast and a latte",
  "Spaghetti bolognese for dinner",
  "How much protein should I eat?",
];

const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
function EstimateCard({
  reply,
  onLog,
  logged,
}: {
  reply: CoachReply;
  onLog: (meal: Meal) => void;
  logged: boolean;
}) {
  const [meal, setMeal] = useState<Meal>(reply.meal);
  const total = reply.items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return (
    <Card style={{ borderColor: colors.accentDim, marginTop: 8, marginBottom: 0 }}>
      {reply.items.map((i, idx) => (
        <View
          key={`${i.name}-${idx}`}
          style={[
            styles.row,
            { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
          ]}
        >
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
        style={[styles.row, { justifyContent: "space-between", marginTop: 10, marginBottom: 10 }]}
      >
        <Text style={[styles.text, { fontWeight: "800" }]}>Total</Text>
        <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 16 }}>
          {Math.round(total.kcal)} kcal · {Math.round(total.protein)} g protein
        </Text>
      </View>
      {logged ? (
        <View style={[styles.row, { justifyContent: "center", paddingVertical: 8 }]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
          <Text style={{ color: colors.accent, fontWeight: "700", marginLeft: 6 }}>
            Added to {meal}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.chipWrap}>
            {MEALS.map((m) => (
              <Chip
                key={m}
                label={m[0].toUpperCase() + m.slice(1)}
                active={meal === m}
                onPress={() => setMeal(m)}
              />
            ))}
          </View>
          <Button title="Add to food log" icon="add" onPress={() => onLog(meal)} />
        </>
      )}
    </Card>
  );
}

export default function ChatScreen() {
  const { data, targets, addFood } = useStore();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [history, setHistory] = useState<ChatHistory>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollViewInstance>(null);

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
          AI chat coming soon
        </Text>
        <Text style={[styles.muted, { textAlign: "center", marginTop: 6 }]}>
          Meanwhile, you can log food from the Food tab.
        </Text>
      </View>
    );
  }

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
      const today = dateKey();
      const { reply, assistantTurn } = await askCoach(nextHistory, {
        profile,
        targets,
        eatenToday: sumMacros(data.foods.filter((f) => f.date === today)),
      });
      setHistory([...nextHistory, assistantTurn]);
      setMessages((m) => [
        ...m,
        { id: `a${Date.now()}`, role: "assistant", text: reply.message, reply },
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

  const logEstimate = (msg: UiMessage, meal: Meal) => {
    if (!msg.reply) return;
    for (const i of msg.reply.items) {
      addFood({
        date: dateKey(),
        meal,
        name: i.name,
        serving: i.portion,
        servings: 1,
        kcal: i.kcal,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
      });
    }
    setLogged((l) => ({ ...l, [msg.id]: true }));
  };

  const last = messages[messages.length - 1];
  const quickOptions =
    !busy && last?.role === "assistant" && last.reply?.status === "asking"
      ? last.reply.options
      : [];

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
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.h1, { fontSize: 22 }]}>What did you eat? 🍽️</Text>
            <Text style={[styles.muted, { marginTop: 6, marginBottom: 16, lineHeight: 20 }]}>
              Describe it in your own words. I'll ask a couple of quick questions, then log the
              calories and macros for you.
            </Text>
            {STARTERS.map((s) => (
              <Pressable
                key={s}
                onPress={() => void send(s)}
                style={({ pressed }) => [
                  styles.card,
                  { paddingVertical: 12, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={styles.text}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {messages.map((m) => (
          <View
            key={m.id}
            style={{ alignItems: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}
          >
            <View
              style={{
                maxWidth: m.reply?.status === "estimate" ? "100%" : "85%",
                width: m.reply?.status === "estimate" ? "100%" : undefined,
                backgroundColor: m.role === "user" ? colors.accent : colors.card,
                borderRadius: 16,
                borderBottomRightRadius: m.role === "user" ? 4 : 16,
                borderBottomLeftRadius: m.role === "user" ? 16 : 4,
                padding: 12,
                borderWidth: m.role === "user" ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: m.role === "user" ? "#06210F" : colors.text,
                  fontSize: 15,
                  lineHeight: 21,
                }}
              >
                {m.text}
              </Text>
              {m.reply?.status === "estimate" ? (
                <EstimateCard
                  reply={m.reply}
                  logged={!!logged[m.id]}
                  onLog={(meal) => logEstimate(m, meal)}
                />
              ) : null}
            </View>
          </View>
        ))}

        {busy ? (
          <View style={[styles.row, { marginBottom: 10 }]}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.muted, { marginLeft: 8 }]}>Thinking…</Text>
          </View>
        ) : null}

        {quickOptions.length ? (
          <View style={styles.chipWrap}>
            {quickOptions.map((o) => (
              <Chip key={o} label={o} active={false} onPress={() => void send(o)} />
            ))}
            <Chip
              label="Just estimate it"
              active={false}
              onPress={() => void send("Just estimate it with typical portions.")}
            />
          </View>
        ) : null}

        {error ? (
          <Card style={{ borderColor: colors.danger, marginTop: 8 }}>
            <Text style={{ color: colors.danger }}>{error}</Text>
          </Card>
        ) : null}
      </ScrollView>

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
          placeholder={messages.length ? "Reply…" : "e.g. a bowl of pasta with pesto"}
          placeholderTextColor={colors.muted}
          style={[styles.input, { flex: 1 }]}
          onSubmitEditing={() => void send(input)}
          returnKeyType="send"
          editable={!busy}
        />
        <Pressable
          onPress={() => void send(input)}
          disabled={busy || !input.trim()}
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy || !input.trim() ? 0.4 : 1,
          }}
          accessibilityLabel="Send"
        >
          <Ionicons name="arrow-up" size={22} color="#06210F" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";

import { colors } from "@/components/theme";
import type { IconName } from "@/components/ui";
import { StepsProvider } from "@/hooks/useTodaySteps";

const ICONS: Record<string, IconName> = {
  index: "sparkles",
  food: "restaurant",
  chat: "chatbubbles",
  gym: "barbell",
  steps: "walk",
  profile: "person",
};

export default function TabLayout() {
  return (
    <StepsProvider>
      <Tabs
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICONS[route.name] ?? "ellipse"} color={color as string} size={size} />
          ),
        })}
      >
        <Tabs.Screen name="index" options={{ title: "Coach" }} />
        <Tabs.Screen name="food" options={{ title: "Food" }} />
        <Tabs.Screen name="chat" options={{ title: "Ask AI" }} />
        <Tabs.Screen name="gym" options={{ title: "Gym" }} />
        <Tabs.Screen name="steps" options={{ title: "Steps" }} />
        <Tabs.Screen name="profile" options={{ title: "Me" }} />
      </Tabs>
    </StepsProvider>
  );
}

import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProfileForm } from "@/components/ProfileForm";
import { colors } from "@/components/theme";
import { styles } from "@/components/ui";
import { useStore } from "@/store/AppStore";

export default function Onboarding() {
  const { saveProfile } = useStore();
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h1, { marginTop: 12 }]}>
            Hey, I'm your <Text style={{ color: colors.accent }}>Rowian Tracker</Text> 👋
          </Text>
          <Text style={[styles.muted, { fontSize: 16, marginTop: 8, marginBottom: 20 }]}>
            Tell me a bit about you and I'll set your calories, macros, daily steps and a gym plan.
          </Text>
          <ProfileForm submitLabel="Build my plan" onSubmit={saveProfile} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { ProfileForm } from "@/components/ProfileForm";
import { styles } from "@/components/ui";
import { useStore } from "@/store/AppStore";

export default function EditProfile() {
  const { data, saveProfile } = useStore();
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ProfileForm
          initial={data.profile}
          submitLabel="Save changes"
          onSubmit={(p) => {
            saveProfile(p);
            router.back();
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import { ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";

export default function RootIndexScreen() {
  const { isHydrated, session } = useAuthSession();

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.shell}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
});

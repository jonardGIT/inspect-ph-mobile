import { StyleSheet } from "react-native";
import { Redirect } from "expo-router";

import { AppScreen, AppStateCard } from "@/components/mobile-ui";
import { useAuthSession } from "@/hooks/use-auth-session";

export default function RootIndexScreen() {
  const { isHydrated, session } = useAuthSession();

  if (!isHydrated) {
    return (
      <AppScreen contentContainerStyle={styles.shell}>
        <AppStateCard
          description="Restoring your secure session and route state."
          loading
          title="Preparing mobile workspace"
        />
      </AppScreen>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  shell: {
    flexGrow: 1,
    justifyContent: "center",
  },
});

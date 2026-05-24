import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import {
  AppButton,
  AppHero,
  AppMessage,
  AppScreen,
  AppTextField,
  MetricTile,
  SectionHeading,
  SurfaceCard,
} from "@/components/mobile-ui";
import { SPACING } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";

export default function LoginScreen() {
  const router = useRouter();
  const { session, isSigningIn, signIn } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleSignIn() {
    setAuthError(null);

    try {
      await signIn({ email, password });
      router.replace("/(tabs)");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to sign in.",
      );
    }
  }

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <AppHero
        eyebrow="InspectPH mobile"
        title="Fieldwork, public access, one mobile shell"
        description="Sign in to review your scoped inspection workload, or open citizen services without an account."
      />

      <SurfaceCard>
        <SectionHeading
          title="Secure sign in"
          description="Use your assigned inspector account or citizen credentials to get started."
        />
        <AppTextField
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          label="Email"
          placeholder="your@email.com"
          value={email}
          onChangeText={setEmail}
        />
        <AppTextField
          autoCapitalize="none"
          autoCorrect={false}
          label="Password"
          placeholder="Your password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {authError ? <AppMessage message={authError} tone="danger" /> : null}
        <AppButton
          disabled={isSigningIn || !email.trim() || !password.trim()}
          fullWidth
          label="Sign in"
          loading={isSigningIn}
          onPress={() => {
            void handleSignIn();
          }}
        />
        <AppButton
          fullWidth
          label="Continue as guest"
          tone="secondary"
          onPress={() => {
            router.replace("/(tabs)/services");
          }}
        />
        <AppButton
          fullWidth
          label="Create an account"
          tone="secondary"
          onPress={() => {
            router.push("/register");
          }}
        />
      </SurfaceCard>

      <SurfaceCard tone="muted">
        <SectionHeading
          title="What mobile is for"
          description="Designed for field inspectors first, while keeping public reporting accessible from the same app."
        />
        <View style={styles.metricGrid}>
          <MetricTile label="Inspector tools" value="3" tone="primary" />
          <MetricTile label="Public flows" value="1" tone="accent" />
        </View>
      </SurfaceCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
});

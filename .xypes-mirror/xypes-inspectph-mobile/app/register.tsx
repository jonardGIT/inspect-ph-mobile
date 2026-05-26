import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import {
  AppButton,
  AppChoicePill,
  AppHero,
  AppMessage,
  AppScreen,
  AppTextField,
  SectionHeading,
  SurfaceCard,
} from "@/components/mobile-ui";
import { SPACING } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import { register } from "@/lib/api";

export default function RegisterScreen() {
  const router = useRouter();
  const { session, signIn } = useAuthSession();
  const [role, setRole] = useState<"citizen" | "business_owner">("citizen");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Name, email, and password are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        ...(role === "business_owner" && businessId.trim()
          ? { businessId: businessId.trim() }
          : {}),
      });

      await signIn({ email: email.trim(), password });
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <AppHero
        eyebrow="InspectPH mobile"
        title="Create an account"
        description="Register as a citizen to submit issue reports, or as a business owner to track your permits and compliance."
      />

      <SurfaceCard>
        <SectionHeading
          title="Account type"
          description="Select the type of account you want to create."
        />
        <View style={styles.pillRow}>
          <AppChoicePill
            label="Citizen"
            selected={role === "citizen"}
            onPress={() => {
              setRole("citizen");
            }}
          />
          <AppChoicePill
            label="Business owner"
            selected={role === "business_owner"}
            onPress={() => {
              setRole("business_owner");
            }}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeading
          title="Your details"
          description="Fill in your name, email, and a secure password."
        />
        <AppTextField
          label="Full name"
          placeholder="Your full name"
          value={name}
          onChangeText={setName}
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
          placeholder="Choose a secure password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {role === "business_owner" ? (
          <AppTextField
            label="Business ID"
            placeholder="UUID of your registered business (optional)"
            value={businessId}
            onChangeText={setBusinessId}
          />
        ) : null}
        {error ? <AppMessage message={error} tone="danger" /> : null}
        <AppButton
          disabled={isSubmitting}
          fullWidth
          label="Create account"
          loading={isSubmitting}
          onPress={() => {
            void handleRegister();
          }}
        />
        <AppButton
          fullWidth
          label="Back to sign in"
          tone="secondary"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/login");
            }
          }}
        />
      </SurfaceCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
  },
  pillRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
});

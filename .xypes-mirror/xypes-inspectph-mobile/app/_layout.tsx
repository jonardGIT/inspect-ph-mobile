import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/react-native";
import { ThemeProvider, createTheme } from "@rneui/themed";

import { COLORS, RADIUS } from "@/constants/theme";
import { AuthSessionProvider } from "@/hooks/use-auth-session";
import { FieldModeProvider } from "@/hooks/use-field-mode";

const rneTheme = createTheme({
  lightColors: {
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    error: COLORS.danger,
    success: COLORS.success,
    warning: COLORS.accent,
    background: COLORS.background,
    white: COLORS.surfaceRaised,
    black: COLORS.text,
  },
  components: {
    Button: { radius: RADIUS.md },
  },
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  enabled: Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function NotificationTapHandler() {
  const responseListener = useRef<ReturnType<
    typeof Notifications.addNotificationResponseReceivedListener
  > | null>(null);

  useEffect(() => {
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<
          string,
          string
        >;

        if (data.entityType === "inspection" && data.entityId) {
          router.push(`/inspections/${data.entityId}`);
        } else {
          router.push("/(tabs)/services");
        }
      });

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  return null;
}

function RootLayout() {
  return (
    <ThemeProvider theme={rneTheme}>
      <AuthSessionProvider>
        <FieldModeProvider>
          <NotificationTapHandler />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              headerShadowVisible: false,
              headerStyle: {
                backgroundColor: COLORS.surfaceRaised,
              },
              headerTintColor: COLORS.text,
              headerTitleStyle: {
                color: COLORS.text,
                fontWeight: "700",
              },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen
              name="register"
              options={{ headerShown: true, title: "Create account" }}
            />
            <Stack.Screen
              name="public-services"
              options={{
                headerShown: true,
                title: "Public services",
              }}
            />
            <Stack.Screen
              name="inspections/schedule"
              options={{
                headerShown: true,
                title: "Schedule",
              }}
            />
            <Stack.Screen
              name="inspections/map"
              options={{
                headerShown: true,
                title: "Inspection map",
              }}
            />
            <Stack.Screen
              name="inspections/[inspectionId]"
              options={{
                headerShown: true,
                title: "Inspection Detail",
              }}
            />
          </Stack>
        </FieldModeProvider>
      </AuthSessionProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(RootLayout);

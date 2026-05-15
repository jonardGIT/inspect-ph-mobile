import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";

import { COLORS } from "@/constants/theme";
import { AuthSessionProvider } from "@/hooks/use-auth-session";

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
        }
      });

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <AuthSessionProvider>
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
    </AuthSessionProvider>
  );
}

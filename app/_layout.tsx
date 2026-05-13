import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthSessionProvider } from '@/hooks/use-auth-session';

export default function RootLayout() {
  return (
    <AuthSessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="inspections/[inspectionId]"
          options={{
            headerShown: true,
            title: 'Inspection Detail',
          }}
        />
      </Stack>
    </AuthSessionProvider>
  );
}

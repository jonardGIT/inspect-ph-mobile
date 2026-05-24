import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { COLORS } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import { canAccessFieldWorkspace } from "@/lib/role-surface";

export default function TabLayout() {
  const { session } = useAuthSession();
  const showField = canAccessFieldWorkspace(session?.user.role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSubtle,
        tabBarStyle: {
          backgroundColor: COLORS.surfaceRaised,
          borderTopColor: COLORS.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              color={color}
              name={focused ? "home" : "home-outline"}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inspect"
        options={{
          title: "Field",
          ...(showField ? {} : { href: null }),
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              color={color}
              name={focused ? "clipboard" : "clipboard-outline"}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Services",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              color={color}
              name={focused ? "document-text" : "document-text-outline"}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              color={color}
              name={focused ? "person" : "person-outline"}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}

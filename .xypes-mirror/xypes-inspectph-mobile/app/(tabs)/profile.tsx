import { ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AppButton,
  AppHero,
  AppStateCard,
  InfoRow,
  SectionHeading,
  StatusBadge,
  SurfaceCard,
} from "@/components/mobile-ui";
import FieldModeToggle from "@/components/field-mode-toggle";
import { COLORS, SPACING } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuthSession();

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHero
            eyebrow="Your account"
            title="Not signed in"
            description="Sign in to see your profile details and account settings."
          />
          <AppStateCard
            title="Sign in to continue"
            description="Your profile and account details are only available when signed in."
            action={
              <AppButton
                fullWidth
                label="Sign in"
                onPress={() => {
                  router.replace("/login");
                }}
              />
            }
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const { user } = session;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHero
          eyebrow="Your account"
          title={user.name}
          description={user.email}
          trailing={<StatusBadge label={user.roleProfile.label} tone="info" />}
        />

        <SurfaceCard>
          <SectionHeading
            title="Account details"
            description="Your profile information on file."
          />
          <InfoRow label="Name" value={user.name} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Role" value={user.roleProfile.label} />
          <InfoRow label="Access scope" value={user.roleProfile.accessScope} />
          {user.officeIds.length > 0 ? (
            <InfoRow
              label="Offices assigned"
              value={String(user.officeIds.length)}
            />
          ) : null}
        </SurfaceCard>

        <SurfaceCard tone="muted">
          <SectionHeading
            title="Field mode"
            description="Toggle high-contrast mode for bright outdoor conditions."
          />
          <FieldModeToggle />
        </SurfaceCard>

        <SurfaceCard>
          <SectionHeading
            title="Sign out"
            description="Signing out clears your session from this device."
          />
          <AppButton
            fullWidth
            label="Sign out"
            tone="secondary"
            onPress={() => {
              void signOut();
            }}
          />
        </SurfaceCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
});

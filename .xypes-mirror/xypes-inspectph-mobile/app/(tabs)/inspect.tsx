import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AppButton,
  AppHero,
  AppStateCard,
  MetricTile,
  SectionHeading,
  SurfaceCard,
} from "@/components/mobile-ui";
import FieldModeToggle from "@/components/field-mode-toggle";
import SyncStatusBar from "@/components/sync-status-bar";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import { ApiRequestError, getInspectionSummary } from "@/lib/api";
import { canAccessFieldWorkspace } from "@/lib/role-surface";

import type { InspectionSummary } from "../../shared/types/api";

function QuickAction(input: {
  body: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.quickActionButton,
        pressed ? styles.pressed : null,
      ]}
      onPress={input.onPress}
    >
      <Text style={styles.quickActionTitle}>{input.title}</Text>
      <Text style={styles.quickActionBody}>{input.body}</Text>
    </Pressable>
  );
}

export default function InspectScreen() {
  const router = useRouter();
  const { session, signOut } = useAuthSession();
  const accessToken = session?.tokens.accessToken;
  const [summary, setSummary] = useState<InspectionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (options?: { refreshing?: boolean }) => {
      if (!accessToken) return;

      if (options?.refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        const data = await getInspectionSummary(accessToken);

        setSummary(data);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          await signOut();
          return;
        }

        setError(
          err instanceof Error ? err.message : "Unable to load summary.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken, signOut],
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  if (!session) return <Redirect href="/login" />;

  if (!canAccessFieldWorkspace(session.user.role)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHero
            eyebrow="Field workspace"
            title="Inspector-only tools"
            description="Field execution stays on mobile for inspectors. Your role should use the dashboard for primary operational work."
          />
          <AppStateCard
            title="Use the dashboard for this role"
            description="Schedule review, intake, approvals, reports, and administration are intentionally kept off the mobile field workspace for non-inspector roles."
            action={
              <AppButton
                fullWidth
                label="Back to home"
                onPress={() => {
                  router.replace("/(tabs)");
                }}
              />
            }
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[COLORS.primary]}
            refreshing={isRefreshing}
            tintColor={COLORS.primary}
            onRefresh={() => {
              void loadSummary({ refreshing: true });
            }}
          />
        }
      >
        <AppHero
          eyebrow="Field workspace"
          title="Inspection tools"
          description={`${session.user.roleProfile.label} · ${session.user.officeIds.length} office${session.user.officeIds.length === 1 ? "" : "s"}`}
        />

        <SyncStatusBar />

        <FieldModeToggle />

        {isLoading ? (
          <AppStateCard
            description="Loading workload data."
            loading
            title="Loading"
          />
        ) : error ? (
          <AppStateCard
            description={error}
            title="Unable to load summary"
            tone="accent"
          />
        ) : summary ? (
          <SurfaceCard tone="muted">
            <SectionHeading
              title="Workload summary"
              description="Current scoped inspection queue across all assigned offices."
            />
            <View style={styles.metricGrid}>
              <MetricTile
                label="Scheduled"
                value={summary.scheduled}
                tone="primary"
              />
              <MetricTile
                label="In progress"
                value={summary.inProgress}
                tone="secondary"
              />
              <MetricTile
                label="Completed"
                value={summary.completed}
                tone="default"
              />
              <MetricTile
                label="Overdue"
                value={summary.overdue}
                tone="accent"
              />
            </View>
          </SurfaceCard>
        ) : null}

        <SurfaceCard>
          <SectionHeading
            title="Field views"
            description="Open the scoped inspection schedule or map for your jurisdiction."
          />
          <View style={styles.quickActionRow}>
            <QuickAction
              body="Review upcoming visits grouped by day."
              onPress={() => {
                router.push("/inspections/schedule");
              }}
              title="Schedule"
            />
            <QuickAction
              body="See inspection pins scoped to your API access."
              onPress={() => {
                router.push("/inspections/map");
              }}
              title="Map"
            />
          </View>
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
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  quickActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  quickActionButton: {
    flex: 1,
    minWidth: 150,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    gap: SPACING.xs,
  },
  pressed: {
    opacity: 0.88,
  },
  quickActionTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.body,
    fontWeight: "800",
  },
  quickActionBody: {
    color: COLORS.textSubtle,
    fontSize: TYPOGRAPHY.label,
    lineHeight: 20,
  },
});

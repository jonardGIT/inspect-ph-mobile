import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AppButton,
  AppHero,
  AppRecordCard,
  AppStateCard,
  AppTextField,
  MetricTile,
  SectionHeading,
  StatusBadge,
  SurfaceCard,
} from "@/components/mobile-ui";
import SyncStatusBar from "@/components/sync-status-bar";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  ApiRequestError,
  getInspectionSummary,
  listInspections,
} from "@/lib/api";

import type {
  InspectionRecord,
  InspectionSummary,
} from "../../shared/types/api";

export default function HomeScreen() {
  const router = useRouter();
  const { isHydrated, isSigningIn, session, signIn, signOut } =
    useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [summary, setSummary] = useState<InspectionSummary | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const isInspector = session?.user.role === "inspector";
  const isSupervisorOrAdmin =
    session?.user.role === "lgu_admin" ||
    session?.user.role === "office_supervisor" ||
    session?.user.role === "office_clerk";
  const isBusinessOwner = session?.user.role === "business_owner";
  const isCitizen = session?.user.role === "citizen";
  const accessToken = session?.tokens.accessToken;

  const loadDashboardData = useCallback(
    async (options?: { refreshing?: boolean }) => {
      if (!accessToken || isBusinessOwner || isCitizen) {
        return;
      }

      if (options?.refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoadingData(true);
      }

      setDataError(null);

      try {
        const nextSummary = await getInspectionSummary(accessToken);

        if (!isInspector) {
          setSummary(nextSummary);
          setInspections([]);
          return;
        }

        const nextInspections = await listInspections({
          accessToken,
          limit: 10,
          page: 1,
        });

        setSummary(nextSummary);
        setInspections(nextInspections.data);
        setCurrentPage(1);
        setHasMore(
          nextInspections.meta.total >
            nextInspections.meta.page * nextInspections.meta.limit,
        );
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) {
          await signOut();
          return;
        }

        setDataError(
          error instanceof Error
            ? error.message
            : "Unable to load inspections.",
        );
      } finally {
        setIsLoadingData(false);
        setIsRefreshing(false);
      }
    },
    [accessToken, isBusinessOwner, isCitizen, isInspector, signOut],
  );

  const loadMore = useCallback(async () => {
    if (!accessToken || !hasMore || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const nextInspections = await listInspections({
        accessToken,
        limit: 10,
        page: nextPage,
      });

      setInspections((prev) => [...prev, ...nextInspections.data]);
      setCurrentPage(nextPage);
      setHasMore(
        nextInspections.meta.total > nextPage * nextInspections.meta.limit,
      );
    } catch {
      // non-fatal — user can retry by tapping the button again
    } finally {
      setIsLoadingMore(false);
    }
  }, [accessToken, currentPage, hasMore, isLoadingMore]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  async function handleSignIn() {
    setAuthError(null);

    try {
      await signIn({ email, password });
      setPassword("");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to sign in.",
      );
    }
  }

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.contentShell}>
          <AppStateCard
            description="Checking secure device storage."
            loading
            title="Restoring session"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.authScrollContent}>
          <AppHero
            eyebrow="InspectPH mobile"
            title="Fieldwork, public access, one mobile shell"
            description="Sign in to review your scoped inspection workload, or open citizen services without an account."
            trailing={<StatusBadge label="Design restored" tone="warning" />}
          />

          <SurfaceCard>
            <SectionHeading
              title="Secure sign in"
              description="Use your assigned inspector account to open scoped schedules, maps, and inspection detail workspaces."
            />
            <AppTextField
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              label="Email"
              placeholder="inspector@example.com"
              value={email}
              onChangeText={setEmail}
            />
            <AppTextField
              autoCapitalize="none"
              autoCorrect={false}
              label="Password"
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {authError ? (
              <Text style={styles.errorText}>{authError}</Text>
            ) : null}
            <AppButton
              disabled={isSigningIn || !email.trim() || !password.trim()}
              fullWidth
              label={isSigningIn ? "Signing in..." : "Sign in"}
              onPress={() => {
                void handleSignIn();
              }}
            />
            <AppButton
              fullWidth
              label="Open public services"
              tone="secondary"
              onPress={() => {
                router.push("/public-services");
              }}
            />
          </SurfaceCard>

          <SurfaceCard tone="muted">
            <SectionHeading
              title="What mobile is for"
              description="Designed for field inspectors first, while still keeping public reporting accessible from the same app entry point."
            />
            <View style={styles.metricGrid}>
              <MetricTile label="Inspector tools" value="3" tone="primary" />
              <MetricTile label="Public flows" value="1" tone="accent" />
            </View>
          </SurfaceCard>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        refreshControl={
          <RefreshControl
            colors={[COLORS.primary]}
            refreshing={isRefreshing}
            tintColor={COLORS.primary}
            onRefresh={() => {
              void loadDashboardData({ refreshing: true });
            }}
          />
        }
      >
        <AppHero
          eyebrow={isInspector ? "Assigned queue" : "Mobile monitoring"}
          title={session.user.name}
          description={
            isBusinessOwner || isCitizen
              ? session.user.roleProfile.label
              : `${session.user.roleProfile.label} · ${session.user.officeIds.length} office${session.user.officeIds.length === 1 ? "" : "s"}${session.user.lguId ? ` · LGU ${session.user.lguId}` : ""}`
          }
          trailing={
            <AppButton
              label="Sign out"
              tone="secondary"
              onPress={() => {
                void signOut();
              }}
            />
          }
        />

        <SyncStatusBar />

        {isInspector || isSupervisorOrAdmin ? (
        <SurfaceCard tone="muted">
          <SectionHeading
            title="Workload summary"
            description="A quick read on your current scoped inspection queue."
          />
          <View style={styles.metricGrid}>
            <MetricTile
              label="Scheduled"
              value={summary?.scheduled ?? 0}
              tone="primary"
            />
            <MetricTile
              label="In progress"
              value={summary?.inProgress ?? 0}
              tone="secondary"
            />
            <MetricTile
              label="Completed"
              value={summary?.completed ?? 0}
              tone="default"
            />
            <MetricTile
              label="Overdue"
              value={summary?.overdue ?? 0}
              tone="accent"
            />
          </View>
        </SurfaceCard>
        ) : null}

        {isInspector || isSupervisorOrAdmin ? (
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
                body="See only inspection pins inside your API scope."
                onPress={() => {
                  router.push("/inspections/map");
                }}
                title="Map"
              />
            </View>
          </SurfaceCard>
        ) : null}

        {isBusinessOwner ? (
          <SurfaceCard>
            <SectionHeading
              title="Your establishment"
              description="Look up your active permits, fire safety certificates, and payments using your permit number."
            />
            <View style={styles.quickActionRow}>
              <QuickAction
                body="Look up permit status, findings, and validity."
                onPress={() => {
                  router.push("/public-services");
                }}
                title="Permit lookup"
              />
              <QuickAction
                body="Check fire safety certificate validity."
                onPress={() => {
                  router.push("/public-services");
                }}
                title="FSIC lookup"
              />
            </View>
            <AppButton
              fullWidth
              label="Open public services"
              tone="secondary"
              onPress={() => {
                router.push("/public-services");
              }}
            />
          </SurfaceCard>
        ) : null}

        {isCitizen ? (
          <SurfaceCard>
            <SectionHeading
              title="Report an issue"
              description="Submit a fire hazard, sanitation, or public safety concern. No account required to report — submissions are reviewed by the relevant office."
            />
            <AppButton
              fullWidth
              label="Submit issue report"
              onPress={() => {
                router.push("/public-services");
              }}
            />
          </SurfaceCard>
        ) : null}

        {isInspector ? (
          <SurfaceCard>
            <SectionHeading
              title="Assigned inspections"
              description="Your list is scoped by the API to the inspections you are allowed to access."
            />
            {isLoadingData ? (
              <AppStateCard
                description="Loading your inspection queue."
                loading
                title="Refreshing workload"
              />
            ) : null}
            {dataError ? (
              <Text style={styles.errorText}>{dataError}</Text>
            ) : null}
            {!isLoadingData && !dataError && inspections.length === 0 ? (
              <AppStateCard
                description="New work will appear here after an office supervisor or admin assigns it."
                title="No assigned inspections"
              />
            ) : null}

            {inspections.map((inspection) => (
              <AppRecordCard
                key={inspection.id}
                onPress={() => {
                  router.push({
                    pathname: "/inspections/[inspectionId]",
                    params: { inspectionId: inspection.id },
                  });
                }}
                title={inspection.business.businessName}
                trailing={
                  <StatusBadge
                    label={inspection.status.replace("_", " ")}
                    tone={getStatusTone(inspection.status)}
                  />
                }
              >
                <Text style={styles.inspectionMeta}>
                  Permit {inspection.permit.permitNumber}
                </Text>
                <Text style={styles.inspectionMeta}>
                  Office {inspection.office.name} · {inspection.office.code}
                </Text>
                <Text style={styles.inspectionMeta}>
                  Scheduled {formatDateTime(inspection.scheduledAt)}
                </Text>
                <Text style={styles.inspectionMeta} numberOfLines={2}>
                  {inspection.notes?.trim() || "No field notes yet."}
                </Text>
              </AppRecordCard>
            ))}
            {hasMore ? (
              <AppButton
                disabled={isLoadingMore}
                fullWidth
                label={isLoadingMore ? "Loading..." : "Load more"}
                tone="secondary"
                onPress={() => {
                  void loadMore();
                }}
              />
            ) : null}
          </SurfaceCard>
        ) : isSupervisorOrAdmin ? (
          <SurfaceCard>
            <SectionHeading
              title="Supervision overview"
              description="Use the field views above to monitor scheduled and in-progress inspections across your jurisdiction. Assignment changes and entity management require the dashboard."
            />
            {dataError ? (
              <Text style={styles.errorText}>{dataError}</Text>
            ) : null}
            <AppButton
              fullWidth
              label="Open public services"
              tone="secondary"
              onPress={() => {
                router.push("/public-services");
              }}
            />
          </SurfaceCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

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
        pressed ? styles.cardPressed : null,
      ]}
      onPress={input.onPress}
    >
      <Text style={styles.quickActionTitle}>{input.title}</Text>
      <Text style={styles.quickActionBody}>{input.body}</Text>
    </Pressable>
  );
}

function getStatusTone(status: InspectionRecord["status"]) {
  if (status === "overdue") {
    return "danger" as const;
  }

  if (status === "completed") {
    return "success" as const;
  }

  if (status === "in_progress") {
    return "warning" as const;
  }

  return "info" as const;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentShell: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
  },
  authScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  dashboardContent: {
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
  cardPressed: {
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
  inspectionMeta: {
    fontSize: TYPOGRAPHY.label,
    color: COLORS.textSubtle,
    lineHeight: 20,
  },
  errorText: {
    fontSize: TYPOGRAPHY.label,
    color: COLORS.danger,
    lineHeight: 20,
  },
});

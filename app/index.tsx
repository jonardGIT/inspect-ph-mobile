import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS, SPACING } from "@/constants/theme";
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
  const [dataError, setDataError] = useState<string | null>(null);
  const isInspector = session?.user.role === "inspector";
  const accessToken = session?.tokens.accessToken;

  const loadDashboardData = useCallback(
    async (options?: { refreshing?: boolean }) => {
      if (!accessToken) {
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
    [accessToken, isInspector, signOut],
  );

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
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateTitle}>Restoring session</Text>
          <Text style={styles.stateBody}>Checking secure device storage.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.authScrollContent}>
          <View style={styles.heroCard}>
            <Text style={styles.kicker}>InspectPH mobile</Text>
            <Text style={styles.title}>Secure sign in</Text>
            <Text style={styles.subtitle}>
              Sign in to review your scoped inspection workload and open the
              mobile experience allowed for your role.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Session</Text>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="inspector@example.com"
              placeholderTextColor={COLORS.mutedText}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.mutedText}
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
            {authError ? (
              <Text style={styles.errorText}>{authError}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSigningIn || !email.trim() || !password.trim()}
              style={[
                styles.primaryButton,
                (isSigningIn || !email.trim() || !password.trim()) &&
                  styles.primaryButtonDisabled,
              ]}
              onPress={() => {
                void handleSignIn();
              }}
            >
              <Text style={styles.primaryButtonLabel}>
                {isSigningIn ? "Signing in..." : "Sign in"}
              </Text>
            </Pressable>
          </View>
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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>
              {isInspector ? "Assigned queue" : "Scoped mobile access"}
            </Text>
            <Text style={styles.title}>{session.user.name}</Text>
            <Text style={styles.subtitle}>
              {session.user.roleProfile.label} · {session.user.officeIds.length}{" "}
              office{session.user.officeIds.length === 1 ? "" : "s"}
            </Text>
            {session.user.lguId ? (
              <Text style={styles.subtitle}>
                LGU scope: {session.user.lguId}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            style={styles.secondaryButton}
            onPress={() => {
              void signOut();
            }}
          >
            <Text style={styles.secondaryButtonLabel}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard label="Scheduled" value={summary?.scheduled ?? 0} />
          <SummaryCard label="In Progress" value={summary?.inProgress ?? 0} />
          <SummaryCard label="Completed" value={summary?.completed ?? 0} />
          <SummaryCard label="Overdue" value={summary?.overdue ?? 0} />
        </View>

        {isInspector ? (
          <View style={styles.quickActionsCard}>
            <Text style={styles.sectionTitle}>Field views</Text>
            <Text style={styles.sectionBody}>
              Open the scoped inspector schedule or map without leaving mobile.
            </Text>
            <View style={styles.quickActionRow}>
              <Pressable
                accessibilityRole="button"
                style={styles.quickActionButton}
                onPress={() => {
                  router.push("/inspections/schedule");
                }}
              >
                <Text style={styles.quickActionTitle}>Schedule</Text>
                <Text style={styles.quickActionBody}>
                  Review upcoming visits grouped by day.
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.quickActionButton}
                onPress={() => {
                  router.push("/inspections/map");
                }}
              >
                <Text style={styles.quickActionTitle}>Map</Text>
                <Text style={styles.quickActionBody}>
                  See only inspection pins inside your API scope.
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {isInspector ? (
          <View style={styles.listCard}>
            <Text style={styles.sectionTitle}>Assigned inspections</Text>
            <Text style={styles.sectionBody}>
              Your list is scoped by the API to the inspections you are allowed
              to access.
            </Text>

            {isLoadingData ? (
              <View style={styles.inlineState}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.stateBody}>
                  Loading your inspection queue.
                </Text>
              </View>
            ) : null}

            {dataError ? (
              <Text style={styles.errorText}>{dataError}</Text>
            ) : null}

            {!isLoadingData && !dataError && inspections.length === 0 ? (
              <View style={styles.inlineState}>
                <Text style={styles.stateTitle}>No assigned inspections</Text>
                <Text style={styles.stateBody}>
                  New work will appear here after an office supervisor or admin
                  assigns it.
                </Text>
              </View>
            ) : null}

            {inspections.map((inspection) => (
              <Pressable
                key={inspection.id}
                accessibilityRole="button"
                style={styles.inspectionCard}
                onPress={() => {
                  router.push({
                    pathname: "/inspections/[inspectionId]",
                    params: { inspectionId: inspection.id },
                  });
                }}
              >
                <View style={styles.inspectionCardHeader}>
                  <Text style={styles.inspectionTitle}>
                    {inspection.business.businessName}
                  </Text>
                  <StatusBadge status={inspection.status} />
                </View>
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
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.listCard}>
            <Text style={styles.sectionTitle}>Mobile scope</Text>
            <Text style={styles.sectionBody}>
              This account can review scoped inspection totals on mobile, but
              field execution and detail capture stay limited to inspector
              accounts.
            </Text>
            {dataError ? (
              <Text style={styles.errorText}>{dataError}</Text>
            ) : null}
            {!dataError ? (
              <View style={styles.inlineState}>
                <Text style={styles.stateTitle}>Read-only role</Text>
                <Text style={styles.stateBody}>
                  Use the dashboard for administration and assignment changes.
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: InspectionRecord["status"] }) {
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusBadgeLabel}>{status.replace("_", " ")}</Text>
    </View>
  );
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
  authScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  dashboardContent: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  heroCard: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: COLORS.primary,
    gap: SPACING.sm,
  },
  formCard: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: COLORS.primaryMuted,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.surface,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.primaryMuted,
    textAlign: "left",
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  sectionBody: {
    fontSize: 14,
    color: COLORS.mutedText,
    lineHeight: 20,
  },
  fieldLabel: {
    marginTop: SPACING.sm,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    backgroundColor: COLORS.background,
    color: COLORS.text,
  },
  primaryButton: {
    marginTop: SPACING.md,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: COLORS.secondary,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonLabel: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.surface,
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  quickActionsCard: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  quickActionRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  quickActionButton: {
    flex: 1,
    borderRadius: 18,
    padding: SPACING.md,
    backgroundColor: COLORS.primaryMuted,
    gap: SPACING.xs,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  quickActionBody: {
    fontSize: 13,
    color: COLORS.mutedText,
    lineHeight: 18,
  },
  summaryCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 20,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.mutedText,
  },
  listCard: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  inspectionCard: {
    borderRadius: 20,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    gap: SPACING.xs,
  },
  inspectionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  inspectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  inspectionMeta: {
    fontSize: 14,
    color: COLORS.mutedText,
    lineHeight: 20,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    backgroundColor: COLORS.primaryMuted,
  },
  statusBadgeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
    textTransform: "capitalize",
  },
  inlineState: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  stateBody: {
    fontSize: 14,
    color: COLORS.mutedText,
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    lineHeight: 20,
  },
});

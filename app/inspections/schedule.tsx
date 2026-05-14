import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS, SPACING } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import { ApiRequestError, listInspections } from "@/lib/api";

import type { InspectionRecord } from "../../../shared/types/api";

interface ScheduleGroup {
  dateLabel: string;
  inspections: InspectionRecord[];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "full",
  }).format(new Date(value));
}

function groupInspectionsByDate(
  inspections: InspectionRecord[],
): ScheduleGroup[] {
  const groups = new Map<string, InspectionRecord[]>();

  for (const inspection of inspections) {
    const dateKey = inspection.scheduledAt.slice(0, 10);
    const bucket = groups.get(dateKey) ?? [];

    bucket.push(inspection);
    groups.set(dateKey, bucket);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, groupedInspections]) => ({
      dateLabel: formatDateLabel(`${dateKey}T00:00:00.000Z`),
      inspections: groupedInspections.sort((left, right) =>
        left.scheduledAt.localeCompare(right.scheduledAt),
      ),
    }));
}

export default function InspectionScheduleScreen() {
  const router = useRouter();
  const { session, signOut } = useAuthSession();
  const accessToken = session?.tokens.accessToken;
  const isInspector = session?.user.role === "inspector";
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduleGroups = useMemo(
    () => groupInspectionsByDate(inspections),
    [inspections],
  );

  async function loadSchedule(options?: { refreshing?: boolean }) {
    if (!accessToken || !isInspector) {
      setInspections([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (options?.refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const response = await listInspections({
        accessToken,
        limit: 50,
        page: 1,
      });

      setInspections(response.data);
    } catch (loadError) {
      if (loadError instanceof ApiRequestError && loadError.status === 401) {
        await signOut();
        router.replace("/");
        return;
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the inspector schedule.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!accessToken) {
      router.replace("/");
      return;
    }

    if (!isInspector) {
      setError("Only inspector accounts can open the mobile schedule.");
      setIsLoading(false);
      return;
    }

    void loadSchedule();
  }, [accessToken, isInspector, router]);

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
              void loadSchedule({ refreshing: true });
            }}
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.kicker}>Inspector schedule</Text>
          <Text style={styles.title}>Upcoming field visits</Text>
          <Text style={styles.subtitle}>
            Every item shown here already respects your assignment, office, and
            LGU scope.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stateTitle}>Loading schedule</Text>
            <Text style={styles.stateBody}>
              Refreshing your scoped field queue.
            </Text>
          </View>
        ) : null}

        {!isLoading && error ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!isLoading && !error && scheduleGroups.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.stateTitle}>No scheduled inspections</Text>
            <Text style={styles.stateBody}>
              New assigned work will appear here after it is scheduled.
            </Text>
          </View>
        ) : null}

        {!isLoading && !error
          ? scheduleGroups.map((group) => (
              <View key={group.dateLabel} style={styles.card}>
                <Text style={styles.sectionTitle}>{group.dateLabel}</Text>
                <View style={styles.groupList}>
                  {group.inspections.map((inspection) => (
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
                      <Text style={styles.inspectionTitle}>
                        {inspection.business.businessName}
                      </Text>
                      <Text style={styles.inspectionMeta}>
                        {inspection.office.name} · {inspection.office.code}
                      </Text>
                      <Text style={styles.inspectionMeta}>
                        {formatDateTime(inspection.scheduledAt)}
                      </Text>
                      <Text style={styles.inspectionStatus}>
                        {inspection.status.replace("_", " ")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          : null}
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
  },
  heroCard: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: COLORS.primary,
    gap: SPACING.sm,
  },
  kicker: {
    color: COLORS.primaryMuted,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: COLORS.surface,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: COLORS.surface,
    fontSize: 15,
    lineHeight: 22,
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.xl,
  },
  card: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    gap: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  groupList: {
    gap: SPACING.md,
  },
  inspectionCard: {
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  inspectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  inspectionMeta: {
    color: COLORS.mutedText,
    fontSize: 14,
  },
  inspectionStatus: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  stateTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  stateBody: {
    color: COLORS.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});

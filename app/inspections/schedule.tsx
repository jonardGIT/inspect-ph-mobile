import { useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AppHero,
  AppRecordCard,
  AppStateCard,
  SectionHeading,
  StatusBadge,
  SurfaceCard,
} from "@/components/mobile-ui";
import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";
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
  const { officeId, officeLabel } = useLocalSearchParams<{
    officeId?: string;
    officeLabel?: string;
  }>();
  const router = useRouter();
  const { session, signOut } = useAuthSession();
  const accessToken = session?.tokens.accessToken;
  const isInspector = session?.user.role === "inspector";
  const selectedOfficeId =
    typeof officeId === "string" && officeId.trim().length > 0
      ? officeId
      : undefined;
  const selectedOfficeLabel =
    typeof officeLabel === "string" && officeLabel.trim().length > 0
      ? officeLabel
      : null;
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
        ...(selectedOfficeId ? { officeId: selectedOfficeId } : {}),
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
  }, [accessToken, isInspector, router, selectedOfficeId]);

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
        <AppHero
          eyebrow="Inspector schedule"
          title={
            selectedOfficeLabel
              ? "Scoped field visits"
              : "Upcoming field visits"
          }
          description={
            selectedOfficeLabel
              ? `Showing only inspections assigned to ${selectedOfficeLabel}.`
              : "Every item shown here already respects your assignment, office, and LGU scope."
          }
          trailing={
            <StatusBadge
              label={`${inspections.length} visits`}
              tone="warning"
            />
          }
        />

        {selectedOfficeLabel ? (
          <SurfaceCard tone="muted">
            <SectionHeading
              title="Office scope"
              description={selectedOfficeLabel}
            />
          </SurfaceCard>
        ) : null}

        {isLoading ? (
          <AppStateCard
            description="Refreshing your scoped field queue."
            loading
            title="Loading schedule"
          />
        ) : null}

        {!isLoading && error ? (
          <AppStateCard
            description={error}
            title="Schedule unavailable"
            tone="accent"
          />
        ) : null}

        {!isLoading && !error && scheduleGroups.length === 0 ? (
          <AppStateCard
            description="New assigned work will appear here after it is scheduled."
            title="No scheduled inspections"
          />
        ) : null}

        {!isLoading && !error
          ? scheduleGroups.map((group) => (
              <SurfaceCard key={group.dateLabel}>
                <SectionHeading
                  title={group.dateLabel}
                  description={`${group.inspections.length} visits queued for this day`}
                />
                <View style={styles.groupList}>
                  {group.inspections.map((inspection) => (
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
                        {inspection.office.name} · {inspection.office.code}
                      </Text>
                      <Text style={styles.inspectionMeta}>
                        Permit {inspection.permit.permitNumber}
                      </Text>
                      <Text style={styles.inspectionMeta}>
                        {formatDateTime(inspection.scheduledAt)}
                      </Text>
                    </AppRecordCard>
                  ))}
                </View>
              </SurfaceCard>
            ))
          : null}
      </ScrollView>
    </SafeAreaView>
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
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.xl,
  },
  groupList: {
    gap: SPACING.md,
  },
  inspectionMeta: {
    color: COLORS.textSubtle,
    fontSize: TYPOGRAPHY.label,
  },
  stateTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.title,
    fontWeight: "800",
    textAlign: "center",
  },
  stateBody: {
    color: COLORS.textSubtle,
    fontSize: TYPOGRAPHY.label,
    lineHeight: 20,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.danger,
    fontSize: TYPOGRAPHY.label,
    lineHeight: 20,
  },
});

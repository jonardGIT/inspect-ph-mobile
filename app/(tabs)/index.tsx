import { useCallback, useEffect, useState } from "react";
import {
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
  MetricTile,
  SectionHeading,
  StatusBadge,
  SurfaceCard,
} from "@/components/mobile-ui";
import SyncStatusBar from "@/components/sync-status-bar";
import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  ApiRequestError,
  getInspectionSummary,
  listInspections,
  listOwnCertificates,
  listOwnIssueReports,
  listOwnPermits,
} from "@/lib/api";

import type {
  FireSafetyCertificateRecord,
  InspectionRecord,
  InspectionSummary,
  IssueReportRecord,
  PermitRecord,
} from "../../../shared/types/api";

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getInspectionStatusTone(status: InspectionRecord["status"]) {
  if (status === "overdue") return "danger" as const;
  if (status === "completed") return "success" as const;
  if (status === "in_progress") return "warning" as const;
  return "info" as const;
}

function getPermitStatusTone(status: PermitRecord["status"]) {
  if (status === "approved") return "success" as const;
  if (status === "rejected" || status === "expired") return "danger" as const;
  if (status === "pending_inspection") return "warning" as const;
  return "default" as const;
}

function getCertStatusTone(status: FireSafetyCertificateRecord["status"]) {
  if (status === "issued") return "success" as const;
  if (status === "expired" || status === "revoked") return "danger" as const;
  return "default" as const;
}

function getReportStatusTone(status: IssueReportRecord["status"]) {
  if (status === "resolved") return "success" as const;
  if (status === "dismissed") return "danger" as const;
  if (status === "under_review") return "warning" as const;
  return "default" as const;
}

export default function HomeScreen() {
  const router = useRouter();
  const { session, signOut } = useAuthSession();
  const accessToken = session?.tokens.accessToken ?? null;

  const isInspector = session?.user.role === "inspector";
  const isSupervisorOrAdmin =
    session?.user.role === "lgu_admin" ||
    session?.user.role === "office_supervisor" ||
    session?.user.role === "admin";
  const isOfficeClerk = session?.user.role === "office_clerk";
  const isBusinessOwner = session?.user.role === "business_owner";
  const isCitizen = session?.user.role === "citizen";

  // Inspector / supervisor / clerk data
  const [summary, setSummary] = useState<InspectionSummary | null>(null);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Business owner data
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [certificates, setCertificates] = useState<
    FireSafetyCertificateRecord[]
  >([]);

  // Citizen data
  const [reports, setReports] = useState<IssueReportRecord[]>([]);

  // Shared load state
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadData = useCallback(
    async (options?: { refreshing?: boolean }) => {
      if (!accessToken) return;

      if (options?.refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setDataError(null);

      try {
        if (isInspector || isSupervisorOrAdmin || isOfficeClerk) {
          const [summaryData, inspectionData] = await Promise.all([
            getInspectionSummary(accessToken),
            isInspector
              ? listInspections({ accessToken, limit: 10, page: 1 })
              : Promise.resolve(null),
          ]);

          setSummary(summaryData);

          if (inspectionData) {
            setInspections(inspectionData.data);
            setCurrentPage(1);
            setHasMore(
              inspectionData.meta.total >
                inspectionData.meta.page * inspectionData.meta.limit,
            );
          }
        } else if (isBusinessOwner) {
          const [permitData, certData] = await Promise.all([
            listOwnPermits(accessToken, { limit: 10 }),
            listOwnCertificates(accessToken, { limit: 5 }),
          ]);

          setPermits(permitData.data);
          setCertificates(certData.data);
        } else if (isCitizen) {
          const reportData = await listOwnIssueReports(accessToken, {
            limit: 10,
          });

          setReports(reportData.data);
        }
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) {
          await signOut();
          return;
        }

        setDataError(
          error instanceof Error ? error.message : "Unable to load your data.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      accessToken,
      isBusinessOwner,
      isCitizen,
      isInspector,
      isOfficeClerk,
      isSupervisorOrAdmin,
      signOut,
    ],
  );

  const loadMoreInspections = useCallback(async () => {
    if (!accessToken || !hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const data = await listInspections({
        accessToken,
        limit: 10,
        page: nextPage,
      });

      setInspections((prev) => [...prev, ...data.data]);
      setCurrentPage(nextPage);
      setHasMore(data.meta.total > nextPage * data.meta.limit);
    } catch {
      // non-fatal — user can load more again
    } finally {
      setIsLoadingMore(false);
    }
  }, [accessToken, currentPage, hasMore, isLoadingMore]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHero
            eyebrow="InspectPH mobile"
            title="Your dashboard"
            description="Sign in to see your inspection queue, permits, or issue reports."
          />
          <AppStateCard
            title="Sign in to continue"
            description="Your personalised dashboard is only available when signed in."
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

  const heroEyebrow = isInspector ? "Assigned queue" : "Mobile monitoring";
  const heroDescription =
    isBusinessOwner || isCitizen
      ? session.user.roleProfile.label
      : `${session.user.roleProfile.label} · ${session.user.officeIds.length} office${session.user.officeIds.length === 1 ? "" : "s"}`;

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
              void loadData({ refreshing: true });
            }}
          />
        }
      >
        <AppHero
          eyebrow={heroEyebrow}
          title={session.user.name}
          description={heroDescription}
        />

        <SyncStatusBar />

        {dataError ? (
          <AppStateCard
            description={dataError}
            title="Unable to load data"
            tone="accent"
          />
        ) : null}

        {/* Inspector / Supervisor / Clerk: workload summary */}
        {(isInspector || isSupervisorOrAdmin || isOfficeClerk) && summary ? (
          <SurfaceCard tone="muted">
            <SectionHeading
              title="Workload summary"
              description="Current scoped inspection queue."
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

        {/* Supervisor / Admin / Clerk guidance */}
        {isSupervisorOrAdmin || isOfficeClerk ? (
          <SurfaceCard>
            <SectionHeading
              title={
                isSupervisorOrAdmin ? "Supervision overview" : "Intake actions"
              }
              description={
                isSupervisorOrAdmin
                  ? "Use the Field tab to monitor scheduled and in-progress inspections. Assignment changes and entity management require the dashboard."
                  : "Use the Field tab to view the schedule and map for your office."
              }
            />
          </SurfaceCard>
        ) : null}

        {/* Inspector: assigned inspection list */}
        {isInspector ? (
          <SurfaceCard>
            <SectionHeading
              title="Assigned inspections"
              description="Scoped to the inspections you are allowed to access."
            />
            {isLoading ? (
              <AppStateCard
                description="Loading your inspection queue."
                loading
                title="Refreshing workload"
              />
            ) : null}
            {!isLoading && inspections.length === 0 && !dataError ? (
              <AppStateCard
                description="New work will appear here after assignment."
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
                    tone={getInspectionStatusTone(inspection.status)}
                  />
                }
              >
                <Text style={styles.recordMeta}>
                  Permit {inspection.permit.permitNumber}
                </Text>
                <Text style={styles.recordMeta}>
                  {inspection.office.name} · {inspection.office.code}
                </Text>
                <Text style={styles.recordMeta}>
                  {formatDateTime(inspection.scheduledAt)}
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
                  void loadMoreInspections();
                }}
              />
            ) : null}
          </SurfaceCard>
        ) : null}

        {/* Business owner: permits + certificates */}
        {isBusinessOwner ? (
          <>
            {isLoading ? (
              <AppStateCard
                description="Loading your permits and certificates."
                loading
                title="Loading"
              />
            ) : null}

            {!isLoading && permits.length === 0 && !dataError ? (
              <AppStateCard
                description="No permits are associated with your account yet."
                title="No permits found"
              />
            ) : null}

            {permits.length > 0 ? (
              <SurfaceCard>
                <SectionHeading
                  title="Your permits"
                  description="Business permits associated with your account."
                />
                {permits.map((permit) => (
                  <AppRecordCard
                    key={permit.id}
                    title={permit.business.businessName}
                    trailing={
                      <StatusBadge
                        label={permit.status.replace("_", " ")}
                        tone={getPermitStatusTone(permit.status)}
                      />
                    }
                  >
                    <Text style={styles.recordMeta}>{permit.permitNumber}</Text>
                    <Text style={styles.recordMeta}>
                      {permit.lineOfBusiness}
                    </Text>
                    <Text style={styles.recordMeta}>
                      Expires {formatDateOnly(permit.expirationDate)}
                    </Text>
                  </AppRecordCard>
                ))}
              </SurfaceCard>
            ) : null}

            {certificates.length > 0 ? (
              <SurfaceCard tone="muted">
                <SectionHeading
                  title="Fire safety certificates"
                  description="Active fire safety certificates for your establishment."
                />
                {certificates.map((cert) => (
                  <AppRecordCard
                    key={cert.id}
                    title={cert.certificateNumber}
                    trailing={
                      <StatusBadge
                        label={cert.status.replace("_", " ")}
                        tone={getCertStatusTone(cert.status)}
                      />
                    }
                  >
                    <Text style={styles.recordMeta}>
                      Permit {cert.inspection.permit.permitNumber}
                    </Text>
                    <Text style={styles.recordMeta}>
                      Issued {formatDateOnly(cert.issuedAt)} · Expires{" "}
                      {formatDateOnly(cert.expiresAt)}
                    </Text>
                    {cert.remarks ? (
                      <Text style={styles.recordMeta}>{cert.remarks}</Text>
                    ) : null}
                  </AppRecordCard>
                ))}
              </SurfaceCard>
            ) : null}
          </>
        ) : null}

        {/* Citizen: own issue reports */}
        {isCitizen ? (
          <>
            <SurfaceCard>
              <SectionHeading
                title="Report a concern"
                description="Submit a fire hazard, sanitation issue, or public safety concern."
              />
              <AppButton
                fullWidth
                label="Open public services"
                onPress={() => {
                  router.push("/(tabs)/services");
                }}
              />
            </SurfaceCard>

            {isLoading ? (
              <AppStateCard
                description="Loading your submitted reports."
                loading
                title="Loading"
              />
            ) : reports.length > 0 ? (
              <SurfaceCard>
                <SectionHeading
                  title="Your reports"
                  description="Issue reports you have submitted."
                />
                {reports.map((report) => (
                  <AppRecordCard
                    key={report.id}
                    title={report.subject}
                    trailing={
                      <StatusBadge
                        label={report.status.replace("_", " ")}
                        tone={getReportStatusTone(report.status)}
                      />
                    }
                  >
                    <Text style={styles.recordMeta}>{report.reportNumber}</Text>
                    <Text style={styles.recordMeta}>
                      {report.category.replace("_", " ")} ·{" "}
                      {formatDateTime(report.createdAt)}
                    </Text>
                  </AppRecordCard>
                ))}
              </SurfaceCard>
            ) : !dataError ? (
              <AppStateCard
                description="Your submitted issue reports will appear here."
                title="No reports yet"
              />
            ) : null}
          </>
        ) : null}
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
  recordMeta: {
    fontSize: TYPOGRAPHY.label,
    color: COLORS.textSubtle,
    lineHeight: 20,
  },
});

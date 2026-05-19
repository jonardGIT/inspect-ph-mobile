import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AppButton,
  AppChoicePill,
  AppHero,
  AppRecordCard,
  AppTextField,
  SectionHeading,
  StatusBadge,
  SurfaceCard,
} from "@/components/mobile-ui";
import { COLORS, SPACING } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  createPublicIssueReport,
  getPublicIssueReportByNumber,
  getPublicPaymentByReferenceNumber,
  getPublicPermitByNumber,
  listMyCaps,
} from "@/lib/api";

import type {
  CorrectiveActionPlanRecord,
  IssueReportRecord,
  PaymentRecord,
  PublicPermitLookupRecord,
} from "../../../shared/types/api";

const CATEGORY_OPTIONS: {
  label: string;
  value: IssueReportRecord["category"];
}[] = [
  { label: "Fire hazard", value: "fire_hazard" },
  { label: "Sanitation", value: "sanitation" },
  { label: "Structural", value: "structural" },
  { label: "Public safety", value: "public_safety" },
  { label: "Other", value: "other" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function formatAmount(amountInMinor: number, currency: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currency || "PHP",
    minimumFractionDigits: 2,
  }).format(amountInMinor / 100);
}

export default function ServicesScreen() {
  const { session } = useAuthSession();
  const isBusinessOwner = session?.user.role === "business_owner";
  const accessToken = session?.tokens.accessToken;

  // CAP list state (business_owner only)
  const [caps, setCaps] = useState<CorrectiveActionPlanRecord[]>([]);
  const [capsLoading, setCapsLoading] = useState(false);
  const [capsError, setCapsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isBusinessOwner || !accessToken) return;

    let cancelled = false;

    setCapsLoading(true);
    setCapsError(null);
    listMyCaps({ accessToken })
      .then((res) => {
        if (!cancelled) setCaps(res.data);
      })
      .catch((err) => {
        if (!cancelled)
          setCapsError(
            err instanceof Error ? err.message : "Unable to load CAPs.",
          );
      })
      .finally(() => {
        if (!cancelled) setCapsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isBusinessOwner, accessToken]);

  // Issue report state
  const [category, setCategory] =
    useState<IssueReportRecord["category"]>("public_safety");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [locationDescription, setLocationDescription] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [lookupValue, setLookupValue] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [createdReport, setCreatedReport] = useState<IssueReportRecord | null>(
    null,
  );
  const [lookupResult, setLookupResult] = useState<IssueReportRecord | null>(
    null,
  );

  // Permit lookup state
  const [permitNumber, setPermitNumber] = useState("");
  const [permitLookupError, setPermitLookupError] = useState<string | null>(
    null,
  );
  const [isLookingUpPermit, setIsLookingUpPermit] = useState(false);
  const [permitResult, setPermitResult] =
    useState<PublicPermitLookupRecord | null>(null);

  // Payment lookup state
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentLookupError, setPaymentLookupError] = useState<string | null>(
    null,
  );
  const [isLookingUpPayment, setIsLookingUpPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentRecord | null>(
    null,
  );

  async function handleSubmit() {
    if (!subject.trim() || !description.trim()) {
      setSubmitError("Subject and description are required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setCreatedReport(null);

    try {
      const nextReport = await createPublicIssueReport({
        category,
        description: description.trim(),
        subject: subject.trim(),
        ...(locationDescription.trim()
          ? { locationDescription: locationDescription.trim() }
          : {}),
        ...(reporterEmail.trim()
          ? { reporterEmail: reporterEmail.trim() }
          : {}),
        ...(reporterName.trim() ? { reporterName: reporterName.trim() } : {}),
      });

      setCreatedReport(nextReport);
      setLookupValue(nextReport.reportNumber);
      setSubject("");
      setDescription("");
      setLocationDescription("");
      setReporterName("");
      setReporterEmail("");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to submit the issue report.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLookup() {
    if (!lookupValue.trim()) {
      setLookupError("Enter a report reference number.");
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const nextResult = await getPublicIssueReportByNumber(lookupValue.trim());

      setLookupResult(nextResult);
    } catch (error) {
      setLookupResult(null);
      setLookupError(
        error instanceof Error ? error.message : "Unable to load the report.",
      );
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handlePermitLookup() {
    if (!permitNumber.trim()) {
      setPermitLookupError("Enter a permit number.");
      return;
    }

    setIsLookingUpPermit(true);
    setPermitLookupError(null);
    setPermitResult(null);

    try {
      const result = await getPublicPermitByNumber({
        permitNumber: permitNumber.trim(),
      });

      setPermitResult(result);
    } catch (error) {
      setPermitLookupError(
        error instanceof Error ? error.message : "Unable to find the permit.",
      );
    } finally {
      setIsLookingUpPermit(false);
    }
  }

  async function handlePaymentLookup() {
    if (!paymentReference.trim()) {
      setPaymentLookupError("Enter a payment reference number.");
      return;
    }

    setIsLookingUpPayment(true);
    setPaymentLookupError(null);
    setPaymentResult(null);

    try {
      const result = await getPublicPaymentByReferenceNumber({
        referenceNumber: paymentReference.trim(),
      });

      setPaymentResult(result);
    } catch (error) {
      setPaymentLookupError(
        error instanceof Error
          ? error.message
          : "Unable to find the payment record.",
      );
    } finally {
      setIsLookingUpPayment(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHero
          eyebrow="InspectPH public services"
          title="Citizen reporting"
          description="Submit a public issue report, track its status, look up a business permit, or check a payment reference."
          trailing={<StatusBadge label="Open access" tone="success" />}
        />

        <SurfaceCard>
          <SectionHeading
            title="New issue report"
            description="Capture a clear report so the right office can act without follow-up calls."
          />
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.segmentRow}>
            {CATEGORY_OPTIONS.map((option) => (
              <AppChoicePill
                key={option.value}
                label={option.label}
                selected={category === option.value}
                onPress={() => {
                  setCategory(option.value);
                }}
              />
            ))}
          </View>
          <AppTextField
            label="Subject"
            placeholder="Unsafe storefront wiring"
            value={subject}
            onChangeText={setSubject}
          />
          <AppTextField
            label="Description"
            multiline
            placeholder="Describe what happened or what needs attention"
            value={description}
            onChangeText={setDescription}
          />
          <AppTextField
            label="Location"
            placeholder="Corner of Mabini and Luna"
            value={locationDescription}
            onChangeText={setLocationDescription}
          />
          <AppTextField
            label="Your name"
            placeholder="Optional"
            value={reporterName}
            onChangeText={setReporterName}
          />
          <AppTextField
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            placeholder="Optional"
            value={reporterEmail}
            onChangeText={setReporterEmail}
          />
          {submitError ? (
            <Text style={styles.errorText}>{submitError}</Text>
          ) : null}
          {createdReport ? (
            <AppRecordCard
              style={styles.inlineCard}
              title="Report submitted"
              trailing={<StatusBadge label="Submitted" tone="success" />}
            >
              <Text style={styles.successBody}>
                Reference {createdReport.reportNumber}
              </Text>
            </AppRecordCard>
          ) : null}
          <AppButton
            disabled={isSubmitting}
            fullWidth
            label={isSubmitting ? "Submitting..." : "Submit issue report"}
            onPress={() => {
              void handleSubmit();
            }}
          />
        </SurfaceCard>

        <SurfaceCard tone="muted">
          <SectionHeading
            title="Track a report"
            description="Enter a reference number such as IR-20260518-ABCD1234."
          />
          <AppTextField
            autoCapitalize="characters"
            label="Reference number"
            placeholder="IR-20260518-ABCD1234"
            value={lookupValue}
            onChangeText={setLookupValue}
          />
          {lookupError ? (
            <Text style={styles.errorText}>{lookupError}</Text>
          ) : null}
          <AppButton
            disabled={isLookingUp}
            fullWidth
            label={isLookingUp ? "Checking..." : "Check report status"}
            tone="secondary"
            onPress={() => {
              void handleLookup();
            }}
          />
          {lookupResult ? (
            <AppRecordCard
              style={styles.inlineCard}
              title={lookupResult.reportNumber}
              trailing={
                <StatusBadge
                  label={lookupResult.status.replace("_", " ")}
                  tone="info"
                />
              }
            >
              <Text style={styles.lookupBody}>{lookupResult.subject}</Text>
              <Text style={styles.lookupMeta}>
                Submitted {formatDate(lookupResult.createdAt)}
              </Text>
              {lookupResult.locationDescription ? (
                <Text style={styles.lookupMeta}>
                  Location: {lookupResult.locationDescription}
                </Text>
              ) : null}
            </AppRecordCard>
          ) : null}
        </SurfaceCard>

        <SurfaceCard tone="muted">
          <SectionHeading
            title="Permit lookup"
            description="Enter a business permit number to check its current status and expiry date."
          />
          <AppTextField
            autoCapitalize="characters"
            label="Permit number"
            placeholder="BPLO-20260101-00001"
            value={permitNumber}
            onChangeText={setPermitNumber}
          />
          {permitLookupError ? (
            <Text style={styles.errorText}>{permitLookupError}</Text>
          ) : null}
          <AppButton
            disabled={isLookingUpPermit}
            fullWidth
            label={isLookingUpPermit ? "Looking up..." : "Look up permit"}
            tone="secondary"
            onPress={() => {
              void handlePermitLookup();
            }}
          />
          {permitResult ? (
            <AppRecordCard
              style={styles.inlineCard}
              title={permitResult.business.businessName}
              trailing={
                <StatusBadge
                  label={permitResult.status.replace("_", " ")}
                  tone={
                    permitResult.status === "approved" ? "success" : "warning"
                  }
                />
              }
            >
              <Text style={styles.lookupBody}>
                Permit {permitResult.permitNumber}
              </Text>
              <Text style={styles.lookupMeta}>
                Line of business: {permitResult.lineOfBusiness}
              </Text>
              <Text style={styles.lookupMeta}>
                Application date: {formatDateOnly(permitResult.applicationDate)}
              </Text>
              <Text style={styles.lookupMeta}>
                Expiration date: {formatDateOnly(permitResult.expirationDate)}
              </Text>
            </AppRecordCard>
          ) : null}
        </SurfaceCard>

        <SurfaceCard tone="muted">
          <SectionHeading
            title="Payment lookup"
            description="Enter a payment reference number to check its status."
          />
          <AppTextField
            autoCapitalize="characters"
            label="Reference number"
            placeholder="PAY-20260101-00001"
            value={paymentReference}
            onChangeText={setPaymentReference}
          />
          {paymentLookupError ? (
            <Text style={styles.errorText}>{paymentLookupError}</Text>
          ) : null}
          <AppButton
            disabled={isLookingUpPayment}
            fullWidth
            label={isLookingUpPayment ? "Looking up..." : "Look up payment"}
            tone="secondary"
            onPress={() => {
              void handlePaymentLookup();
            }}
          />
          {paymentResult ? (
            <AppRecordCard
              style={styles.inlineCard}
              title={paymentResult.referenceNumber}
              trailing={
                <StatusBadge
                  label={paymentResult.status}
                  tone={
                    paymentResult.status === "paid"
                      ? "success"
                      : paymentResult.status === "failed"
                        ? "danger"
                        : "warning"
                  }
                />
              }
            >
              <Text style={styles.lookupBody}>
                {formatAmount(
                  paymentResult.amountInMinor,
                  paymentResult.currency,
                )}
              </Text>
              <Text style={styles.lookupMeta}>
                Permit {paymentResult.permit.permitNumber} ·{" "}
                {paymentResult.permit.business.businessName}
              </Text>
              {paymentResult.description ? (
                <Text style={styles.lookupMeta}>
                  {paymentResult.description}
                </Text>
              ) : null}
              {paymentResult.paidAt ? (
                <Text style={styles.lookupMeta}>
                  Paid {formatDate(paymentResult.paidAt)}
                </Text>
              ) : null}
              {paymentResult.failureReason ? (
                <Text style={styles.errorText}>
                  Failure: {paymentResult.failureReason}
                </Text>
              ) : null}
            </AppRecordCard>
          ) : null}
        </SurfaceCard>

        {isBusinessOwner ? (
          <SurfaceCard>
            <SectionHeading
              title="Corrective Action Plans"
              description="Open compliance items assigned to your business."
            />
            {capsLoading ? (
              <Text style={styles.lookupMeta}>Loading…</Text>
            ) : null}
            {capsError ? (
              <Text style={styles.errorText}>{capsError}</Text>
            ) : null}
            {!capsLoading && !capsError && caps.length === 0 ? (
              <Text style={styles.lookupMeta}>
                No open corrective action plans.
              </Text>
            ) : null}
            {caps.map((cap) => (
              <AppRecordCard
                key={cap.id}
                title={cap.finding?.title ?? `CAP ${cap.id.slice(0, 8)}`}
                trailing={
                  <StatusBadge
                    label={cap.status.toUpperCase()}
                    tone={
                      cap.status === "resolved"
                        ? "success"
                        : cap.status === "escalated"
                          ? "danger"
                          : "warning"
                    }
                  />
                }
              >
                {cap.deadlineAt ? (
                  <Text style={styles.lookupMeta}>
                    Deadline: {formatDateOnly(cap.deadlineAt)}
                  </Text>
                ) : null}
                {cap.responseNote ? (
                  <Text style={styles.lookupMeta}>{cap.responseNote}</Text>
                ) : null}
              </AppRecordCard>
            ))}
          </SurfaceCard>
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
  fieldLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
  },
  inlineCard: {
    backgroundColor: COLORS.accentMuted,
  },
  successBody: {
    color: COLORS.text,
    fontSize: 14,
  },
  lookupBody: {
    color: COLORS.text,
    fontSize: 14,
  },
  lookupMeta: {
    color: COLORS.mutedText,
    fontSize: 13,
  },
});

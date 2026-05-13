import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS, SPACING } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  ApiRequestError,
  createInspectionFinding,
  getInspectionDetail,
  listChecklistTemplates,
  listInspectionAttachments,
  listInspectionChecklistResults,
  listInspectionFindings,
  updateInspectionStatus,
  uploadInspectionAttachment,
  upsertInspectionChecklistResult,
} from "@/lib/api";
import {
  enqueueAttachmentUpload,
  enqueueFindingCreate,
  listQueuedAttachmentUploads,
  listQueuedFindingCreates,
  markQueuedAttachmentUploadFailed,
  markQueuedAttachmentUploadPending,
  markQueuedFindingCreateFailed,
  markQueuedFindingCreatePending,
  removeQueuedAttachmentUpload,
  removeQueuedFindingCreate,
  type QueuedAttachmentUpload,
  type QueuedFindingCreate,
} from "../../lib/storage/attachment-upload-queue";

import type {
  AttachmentRecord,
  ChecklistTemplateRecord,
  FindingRecord,
  InspectionChecklistResultRecord,
  InspectionRecord,
} from "../../../shared/types/api";

type ChecklistStatus = InspectionChecklistResultRecord["status"];
type FindingSeverity = FindingRecord["severity"];

interface ChecklistDraft {
  remarks: string;
  status: ChecklistStatus;
}

export default function InspectionDetailScreen() {
  const { inspectionId } = useLocalSearchParams<{ inspectionId: string }>();
  const router = useRouter();
  const { session, signOut } = useAuthSession();
  const accessToken = session?.tokens.accessToken;
  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  const [checklistTemplates, setChecklistTemplates] = useState<
    ChecklistTemplateRecord[]
  >([]);
  const [checklistResults, setChecklistResults] = useState<
    InspectionChecklistResultRecord[]
  >([]);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [queuedFindings, setQueuedFindings] = useState<QueuedFindingCreate[]>(
    [],
  );
  const [queuedAttachments, setQueuedAttachments] = useState<
    QueuedAttachmentUpload[]
  >([]);
  const [checklistDrafts, setChecklistDrafts] = useState<
    Record<string, ChecklistDraft>
  >({});
  const [findingTitle, setFindingTitle] = useState("");
  const [findingDescription, setFindingDescription] = useState("");
  const [findingCorrectiveAction, setFindingCorrectiveAction] = useState("");
  const [findingSeverity, setFindingSeverity] =
    useState<FindingSeverity>("medium");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [findingError, setFindingError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [isCreatingFinding, setIsCreatingFinding] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [retryingFindingId, setRetryingFindingId] = useState<string | null>(null);
  const [retryingAttachmentId, setRetryingAttachmentId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function resetFindingDraft() {
    setFindingTitle("");
    setFindingDescription("");
    setFindingCorrectiveAction("");
    setFindingSeverity("medium");
  }

  useEffect(() => {
    if (!accessToken) {
      router.replace("/");
      return;
    }

    const token = accessToken;

    if (!inspectionId) {
      setError("Inspection ID is missing.");
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    async function loadQueuedFindings() {
      const nextQueuedFindings = await listQueuedFindingCreates(inspectionId);

      if (!isCancelled) {
        setQueuedFindings(nextQueuedFindings);
      }
    }

    async function loadQueuedAttachments() {
      const nextQueuedAttachments = await listQueuedAttachmentUploads(inspectionId);

      if (!isCancelled) {
        setQueuedAttachments(nextQueuedAttachments);
      }
    }

    async function loadInspectionWorkspace() {
      setIsLoading(true);
      setError(null);

      try {
        const [
          detail,
          nextChecklistTemplates,
          nextChecklistResults,
          nextFindings,
          nextAttachments,
        ] = await Promise.all([
          getInspectionDetail(token, inspectionId),
          listChecklistTemplates(token),
          listInspectionChecklistResults(token, inspectionId),
          listInspectionFindings(token, inspectionId),
          listInspectionAttachments(token, inspectionId),
        ]);

        if (isCancelled) {
          return;
        }

        setInspection(detail);
        setChecklistTemplates(nextChecklistTemplates);
        setChecklistResults(nextChecklistResults);
        setFindings(nextFindings);
        setAttachments(nextAttachments);
        setChecklistDrafts(
          createChecklistDrafts(nextChecklistTemplates, nextChecklistResults),
        );
        await loadQueuedFindings();
        await loadQueuedAttachments();
      } catch (loadError) {
        if (loadError instanceof ApiRequestError && loadError.status === 401) {
          await signOut();
          router.replace("/");
          return;
        }

        if (!isCancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load inspection details.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInspectionWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, inspectionId, router, signOut]);

  async function withLocationCapture() {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      throw new Error("Location permission is required for field capture.");
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      ...(typeof position.coords.accuracy === "number"
        ? { accuracyMeters: position.coords.accuracy }
        : {}),
    };
  }

  async function handleStatusAdvance(nextStatus: InspectionRecord["status"]) {
    if (!accessToken || !inspectionId) {
      return;
    }

    setIsUpdatingStatus(true);
    setStatusError(null);

    try {
      const location = await withLocationCapture();
      const updatedInspection = await updateInspectionStatus({
        accessToken,
        inspectionId,
        status: nextStatus,
        ...location,
      });

      setInspection(updatedInspection);
    } catch (updateError) {
      setStatusError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update inspection status.",
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleChecklistSave(template: ChecklistTemplateRecord) {
    if (!accessToken || !inspectionId) {
      return;
    }

    const draft = checklistDrafts[template.id];

    if (!draft) {
      return;
    }

    setSavingTemplateId(template.id);
    setChecklistError(null);

    try {
      const savedResult = await upsertInspectionChecklistResult({
        accessToken,
        inspectionId,
        remarks: draft.remarks,
        status: draft.status,
        templateId: template.id,
      });

      setChecklistResults((currentResults) => {
        const existingIndex = currentResults.findIndex(
          (result) => result.template.id === template.id,
        );

        if (existingIndex === -1) {
          return [...currentResults, savedResult];
        }

        return currentResults.map((result) =>
          result.template.id === template.id ? savedResult : result,
        );
      });
    } catch (saveError) {
      setChecklistError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save checklist result.",
      );
    } finally {
      setSavingTemplateId(null);
    }
  }

  async function handleCreateFinding() {
    if (!accessToken || !inspectionId) {
      return;
    }

    if (!findingTitle.trim() || !findingDescription.trim()) {
      setFindingError("Title and description are required.");
      return;
    }

    setIsCreatingFinding(true);
    setFindingError(null);

    let queuedFinding:
      | {
          accuracyMeters?: number;
          correctiveAction?: string;
          description: string;
          inspectionId: string;
          latitude?: number;
          longitude?: number;
          severity: FindingSeverity;
          title: string;
        }
      | null = null;

    try {
      const location = await withLocationCapture();
      queuedFinding = {
        description: findingDescription.trim(),
        inspectionId,
        severity: findingSeverity,
        title: findingTitle.trim(),
        ...(findingCorrectiveAction.trim()
          ? { correctiveAction: findingCorrectiveAction.trim() }
          : {}),
        ...location,
      };
      const finding = await createInspectionFinding({
        accessToken,
        ...queuedFinding,
      });

      setFindings((currentFindings) => [finding, ...currentFindings]);
      resetFindingDraft();
    } catch (createError) {
      const errorMessage =
        createError instanceof Error
          ? createError.message
          : "Unable to create finding.";

      if (
        queuedFinding &&
        createError instanceof Error &&
        !createError.message.toLowerCase().includes("permission") &&
        !createError.message.toLowerCase().includes("required")
      ) {
        const queuedItem = await enqueueFindingCreate(queuedFinding);

        setQueuedFindings((currentFindings) => [queuedItem, ...currentFindings]);
        resetFindingDraft();
        setFindingError(
          "Finding was queued for retry. Use the sync status below when the network is available.",
        );
      } else {
        setFindingError(errorMessage);
      }
    } finally {
      setIsCreatingFinding(false);
    }
  }

  async function handleRetryQueuedFinding(item: QueuedFindingCreate) {
    if (!accessToken || !inspectionId) {
      return;
    }

    setRetryingFindingId(item.id);
    setFindingError(null);

    try {
      await markQueuedFindingCreatePending(item.id);
      setQueuedFindings((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? (() => {
                const { lastError: _lastError, ...rest } = currentItem;

                return { ...rest, status: "pending" as const };
              })()
            : currentItem,
        ),
      );

      const finding = await createInspectionFinding({
        accessToken,
        description: item.description,
        inspectionId,
        severity: item.severity,
        title: item.title,
        ...(item.correctiveAction
          ? { correctiveAction: item.correctiveAction }
          : {}),
        ...(typeof item.latitude === "number" ? { latitude: item.latitude } : {}),
        ...(typeof item.longitude === "number"
          ? { longitude: item.longitude }
          : {}),
        ...(typeof item.accuracyMeters === "number"
          ? { accuracyMeters: item.accuracyMeters }
          : {}),
      });

      await removeQueuedFindingCreate(item.id);
      setQueuedFindings((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== item.id),
      );
      setFindings((currentFindings) => [finding, ...currentFindings]);
    } catch (retryError) {
      const errorMessage =
        retryError instanceof Error
          ? retryError.message
          : "Unable to retry the queued finding.";

      await markQueuedFindingCreateFailed(item.id, errorMessage);
      setQueuedFindings((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                lastError: errorMessage,
                retryCount: currentItem.retryCount + 1,
                status: "failed",
              }
            : currentItem,
        ),
      );
      setFindingError(errorMessage);
    } finally {
      setRetryingFindingId(null);
    }
  }

  async function handleRetryAllQueuedFindings() {
    for (const item of queuedFindings) {
      await handleRetryQueuedFinding(item);
    }
  }

  async function pickAttachment(
    source: "camera" | "library",
  ): Promise<ImagePicker.ImagePickerAsset | null> {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        throw new Error("Camera permission is required to capture evidence.");
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      return result.canceled ? null : (result.assets[0] ?? null);
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Photo library permission is required to attach evidence.");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      selectionLimit: 1,
    });

    return result.canceled ? null : (result.assets[0] ?? null);
  }

  async function handleAttachmentUpload(source: "camera" | "library") {
    if (!accessToken || !inspectionId) {
      return;
    }

    setAttachmentError(null);
    setIsUploadingAttachment(true);

    let queuedUpload:
      | {
          accuracyMeters?: number;
          capturedAt: string;
          fileName: string;
          inspectionId: string;
          latitude?: number;
          longitude?: number;
          mimeType: string;
          uri: string;
        }
      | null = null;

    try {
      const asset = await pickAttachment(source);

      if (!asset) {
        return;
      }

      const location = await withLocationCapture();
      queuedUpload = {
        capturedAt: new Date().toISOString(),
        fileName: resolveAttachmentFileName(asset, source),
        inspectionId,
        mimeType: asset.mimeType || "image/jpeg",
        uri: asset.uri,
        ...location,
      };
      const attachment = await uploadInspectionAttachment({
        accessToken,
        inspectionId,
        file: {
          ...queuedUpload,
        },
      });

      setAttachments((currentAttachments) => [attachment, ...currentAttachments]);
    } catch (uploadError) {
      const errorMessage =
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload attachment.";

      if (
        queuedUpload &&
        uploadError instanceof Error &&
        !uploadError.message.toLowerCase().includes("permission") &&
        !uploadError.message.toLowerCase().includes("required")
      ) {
        const queuedItem = await enqueueAttachmentUpload(queuedUpload);

        setQueuedAttachments((currentAttachments) => [
          queuedItem,
          ...currentAttachments,
        ]);
        setAttachmentError(
          "Upload was queued for retry. Open Sync status below to retry when the network is available.",
        );
      } else {
        setAttachmentError(errorMessage);
      }
    } finally {
      setIsUploadingAttachment(false);
    }
  }

  async function handleRetryQueuedAttachment(item: QueuedAttachmentUpload) {
    if (!accessToken || !inspectionId) {
      return;
    }

    setRetryingAttachmentId(item.id);
    setAttachmentError(null);

    try {
      await markQueuedAttachmentUploadPending(item.id);
      setQueuedAttachments((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? (() => {
                const { lastError: _lastError, ...rest } = currentItem;

                return { ...rest, status: "pending" as const };
              })()
            : currentItem,
        ),
      );

      const attachment = await uploadInspectionAttachment({
        accessToken,
        inspectionId,
        file: {
          fileName: item.fileName,
          mimeType: item.mimeType,
          uri: item.uri,
          ...(item.capturedAt ? { capturedAt: item.capturedAt } : {}),
          ...(typeof item.latitude === "number" ? { latitude: item.latitude } : {}),
          ...(typeof item.longitude === "number"
            ? { longitude: item.longitude }
            : {}),
          ...(typeof item.accuracyMeters === "number"
            ? { accuracyMeters: item.accuracyMeters }
            : {}),
        },
      });

      await removeQueuedAttachmentUpload(item.id);
      setQueuedAttachments((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== item.id),
      );
      setAttachments((currentAttachments) => [attachment, ...currentAttachments]);
    } catch (retryError) {
      const errorMessage =
        retryError instanceof Error
          ? retryError.message
          : "Unable to retry the queued attachment.";

      await markQueuedAttachmentUploadFailed(item.id, errorMessage);
      setQueuedAttachments((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                lastError: errorMessage,
                retryCount: currentItem.retryCount + 1,
                status: "failed",
              }
            : currentItem,
        ),
      );
      setAttachmentError(errorMessage);
    } finally {
      setRetryingAttachmentId(null);
    }
  }

  async function handleRetryAllQueuedAttachments() {
    for (const item of queuedAttachments) {
      await handleRetryQueuedAttachment(item);
    }
  }

  const checklistItems = createChecklistItems(
    checklistTemplates,
    checklistResults,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stateTitle}>Loading inspection</Text>
            <Text style={styles.stateBody}>Pulling assigned field data.</Text>
          </View>
        ) : null}

        {!isLoading && error ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!isLoading && !error && inspection ? (
          <>
            <View style={[styles.card, styles.heroCard]}>
              <Text style={styles.kicker}>Inspection detail</Text>
              <Text style={styles.heroTitle}>
                {inspection.business.businessName}
              </Text>
              <Text style={styles.heroBody}>
                Permit {inspection.permit.permitNumber} •{" "}
                {formatDateTime(inspection.scheduledAt)}
              </Text>
              <Text style={styles.heroBody}>
                Status {inspection.status.replace("_", " ")}
              </Text>
              <Text style={styles.heroBody}>
                {inspection.notes?.trim() || "No field notes yet."}
              </Text>
              <View style={styles.actionRow}>
                {inspection.status === "scheduled" ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isUpdatingStatus}
                    style={[
                      styles.primaryButton,
                      isUpdatingStatus && styles.buttonDisabled,
                    ]}
                    onPress={() => {
                      void handleStatusAdvance("in_progress");
                    }}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isUpdatingStatus
                        ? "Capturing GPS..."
                        : "Start inspection"}
                    </Text>
                  </Pressable>
                ) : null}
                {inspection.status === "in_progress" ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isUpdatingStatus}
                    style={[
                      styles.primaryButton,
                      isUpdatingStatus && styles.buttonDisabled,
                    ]}
                    onPress={() => {
                      void handleStatusAdvance("completed");
                    }}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isUpdatingStatus
                        ? "Capturing GPS..."
                        : "Complete inspection"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {statusError ? (
                <Text style={styles.errorText}>{statusError}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Geo capture</Text>
              <Text style={styles.sectionBody}>
                {inspection.location
                  ? `${inspection.location.latitude.toFixed(5)}, ${inspection.location.longitude.toFixed(5)}${inspection.location.accuracyMeters ? ` • ${inspection.location.accuracyMeters}m accuracy` : ""}`
                  : "No location captured yet for this inspection."}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Checklist</Text>
              <Text style={styles.sectionBody}>
                Save each checkpoint as you work. Existing results stay
                editable.
              </Text>
              {checklistError ? (
                <Text style={styles.errorText}>{checklistError}</Text>
              ) : null}
              {checklistItems.length === 0 ? (
                <Text style={styles.sectionBody}>
                  No checklist responses yet.
                </Text>
              ) : (
                checklistItems.map((item) => {
                  const draft = checklistDrafts[item.template.id] ?? {
                    remarks: "",
                    status: "pass" as ChecklistStatus,
                  };

                  return (
                    <View key={item.template.id} style={styles.rowItem}>
                      <Text style={styles.rowTitle}>{item.template.title}</Text>
                      <Text style={styles.rowMeta}>
                        {item.result
                          ? `Saved as ${item.result.status.replace("_", " ")}`
                          : "Pending response"}
                      </Text>
                      <View style={styles.segmentRow}>
                        {CHECKLIST_STATUS_OPTIONS.map((option) => (
                          <Pressable
                            key={option}
                            accessibilityRole="button"
                            style={[
                              styles.segmentButton,
                              draft.status === option &&
                                styles.segmentButtonActive,
                            ]}
                            onPress={() => {
                              setChecklistDrafts((currentDrafts) => ({
                                ...currentDrafts,
                                [item.template.id]: {
                                  remarks:
                                    currentDrafts[item.template.id]?.remarks ??
                                    "",
                                  status: option,
                                },
                              }));
                            }}
                          >
                            <Text
                              style={[
                                styles.segmentButtonLabel,
                                draft.status === option &&
                                  styles.segmentButtonLabelActive,
                              ]}
                            >
                              {option.replace("_", " ")}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <TextInput
                        multiline
                        placeholder="Inspector remarks"
                        placeholderTextColor={COLORS.mutedText}
                        style={styles.input}
                        value={draft.remarks}
                        onChangeText={(value) => {
                          setChecklistDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [item.template.id]: {
                              remarks: value,
                              status:
                                currentDrafts[item.template.id]?.status ??
                                "pass",
                            },
                          }));
                        }}
                      />
                      <Pressable
                        accessibilityRole="button"
                        disabled={savingTemplateId === item.template.id}
                        style={[
                          styles.secondaryButton,
                          savingTemplateId === item.template.id &&
                            styles.buttonDisabled,
                        ]}
                        onPress={() => {
                          void handleChecklistSave(item.template);
                        }}
                      >
                        <Text style={styles.secondaryButtonLabel}>
                          {savingTemplateId === item.template.id
                            ? "Saving..."
                            : "Save checklist item"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Findings</Text>
              <TextInput
                placeholder="Finding title"
                placeholderTextColor={COLORS.mutedText}
                style={styles.input}
                value={findingTitle}
                onChangeText={setFindingTitle}
              />
              <TextInput
                multiline
                placeholder="Finding description"
                placeholderTextColor={COLORS.mutedText}
                style={[styles.input, styles.multilineInput]}
                value={findingDescription}
                onChangeText={setFindingDescription}
              />
              <TextInput
                placeholder="Corrective action"
                placeholderTextColor={COLORS.mutedText}
                style={styles.input}
                value={findingCorrectiveAction}
                onChangeText={setFindingCorrectiveAction}
              />
              <View style={styles.segmentRow}>
                {FINDING_SEVERITIES.map((severity) => (
                  <Pressable
                    key={severity}
                    accessibilityRole="button"
                    style={[
                      styles.segmentButton,
                      findingSeverity === severity &&
                        styles.segmentButtonActive,
                    ]}
                    onPress={() => {
                      setFindingSeverity(severity);
                    }}
                  >
                    <Text
                      style={[
                        styles.segmentButtonLabel,
                        findingSeverity === severity &&
                          styles.segmentButtonLabelActive,
                      ]}
                    >
                      {severity}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isCreatingFinding}
                style={[
                  styles.primaryButton,
                  isCreatingFinding && styles.buttonDisabled,
                ]}
                onPress={() => {
                  void handleCreateFinding();
                }}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isCreatingFinding
                    ? "Capturing GPS..."
                    : "Create finding with GPS"}
                </Text>
              </Pressable>
              {findingError ? (
                <Text style={styles.errorText}>{findingError}</Text>
              ) : null}
              {queuedFindings.length > 0 ? (
                <View style={styles.syncCard}>
                  <Text style={styles.syncTitle}>Sync status</Text>
                  <Text style={styles.sectionBody}>
                    {queuedFindings.length} finding{queuedFindings.length === 1 ? "" : "s"} waiting for retry.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={Boolean(retryingFindingId)}
                    style={[
                      styles.secondaryButton,
                      Boolean(retryingFindingId) && styles.buttonDisabled,
                    ]}
                    onPress={() => {
                      void handleRetryAllQueuedFindings();
                    }}
                  >
                    <Text style={styles.secondaryButtonLabel}>
                      {retryingFindingId ? "Retrying..." : "Retry pending findings"}
                    </Text>
                  </Pressable>
                  {queuedFindings.map((item) => (
                    <View key={item.id} style={styles.queuedRow}>
                      <View style={styles.queuedBody}>
                        <Text style={styles.rowTitle}>{item.title}</Text>
                        <Text style={styles.rowMeta}>
                          {item.status === "pending" ? "Pending sync" : "Retry failed"} • Attempt {item.retryCount + 1}
                        </Text>
                        <Text style={styles.rowMeta}>
                          Severity {item.severity} • Queued {formatDateTime(item.queuedAt)}
                        </Text>
                        {item.lastError ? (
                          <Text style={styles.errorText}>{item.lastError}</Text>
                        ) : null}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={retryingFindingId === item.id}
                        style={[
                          styles.secondaryButton,
                          styles.inlineButton,
                          retryingFindingId === item.id && styles.buttonDisabled,
                        ]}
                        onPress={() => {
                          void handleRetryQueuedFinding(item);
                        }}
                      >
                        <Text style={styles.secondaryButtonLabel}>
                          {retryingFindingId === item.id ? "Retrying" : "Retry"}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              {findings.length === 0 ? (
                <Text style={styles.sectionBody}>
                  No findings recorded yet.
                </Text>
              ) : (
                findings.map((finding) => (
                  <View key={finding.id} style={styles.rowItem}>
                    <Text style={styles.rowTitle}>{finding.title}</Text>
                    <Text style={styles.rowMeta}>
                      Severity {finding.severity} •{" "}
                      {finding.resolvedAt ? "Resolved" : "Open"}
                    </Text>
                    <Text style={styles.rowMeta}>{finding.description}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Attachments</Text>
              <Text style={styles.sectionBody}>
                Capture evidence photos in the field or attach them from the device library.
              </Text>
              {queuedAttachments.length > 0 ? (
                <View style={styles.syncCard}>
                  <Text style={styles.syncTitle}>Sync status</Text>
                  <Text style={styles.sectionBody}>
                    {queuedAttachments.length} attachment{queuedAttachments.length === 1 ? "" : "s"} waiting for retry.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={Boolean(retryingAttachmentId)}
                    style={[
                      styles.secondaryButton,
                      Boolean(retryingAttachmentId) && styles.buttonDisabled,
                    ]}
                    onPress={() => {
                      void handleRetryAllQueuedAttachments();
                    }}
                  >
                    <Text style={styles.secondaryButtonLabel}>
                      {retryingAttachmentId ? "Retrying..." : "Retry pending uploads"}
                    </Text>
                  </Pressable>
                  {queuedAttachments.map((item) => (
                    <View key={item.id} style={styles.queuedRow}>
                      <View style={styles.queuedBody}>
                        <Text style={styles.rowTitle}>{item.fileName}</Text>
                        <Text style={styles.rowMeta}>
                          {item.status === "pending" ? "Pending sync" : "Retry failed"} • Attempt {item.retryCount + 1}
                        </Text>
                        <Text style={styles.rowMeta}>
                          Queued {formatDateTime(item.queuedAt)}
                        </Text>
                        {item.lastError ? (
                          <Text style={styles.errorText}>{item.lastError}</Text>
                        ) : null}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={retryingAttachmentId === item.id}
                        style={[
                          styles.secondaryButton,
                          styles.inlineButton,
                          retryingAttachmentId === item.id && styles.buttonDisabled,
                        ]}
                        onPress={() => {
                          void handleRetryQueuedAttachment(item);
                        }}
                      >
                        <Text style={styles.secondaryButtonLabel}>
                          {retryingAttachmentId === item.id ? "Retrying" : "Retry"}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.segmentRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isUploadingAttachment}
                  style={[
                    styles.primaryButton,
                    styles.flexButton,
                    isUploadingAttachment && styles.buttonDisabled,
                  ]}
                  onPress={() => {
                    void handleAttachmentUpload("camera");
                  }}
                >
                  <Text style={styles.primaryButtonLabel}>
                    {isUploadingAttachment ? "Uploading..." : "Capture photo"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isUploadingAttachment}
                  style={[
                    styles.secondaryButton,
                    styles.flexButton,
                    isUploadingAttachment && styles.buttonDisabled,
                  ]}
                  onPress={() => {
                    void handleAttachmentUpload("library");
                  }}
                >
                  <Text style={styles.secondaryButtonLabel}>Attach from library</Text>
                </Pressable>
              </View>
              {attachmentError ? (
                <Text style={styles.errorText}>{attachmentError}</Text>
              ) : null}
              {attachments.length === 0 ? (
                <Text style={styles.sectionBody}>
                  No attachments uploaded for this inspection yet.
                </Text>
              ) : (
                attachments.map((attachment) => (
                  <View key={attachment.id} style={styles.rowItem}>
                    <View style={styles.attachmentHeaderRow}>
                      <View style={styles.attachmentPreviewShell}>
                        <Text style={styles.attachmentPreviewLabel}>IMG</Text>
                      </View>
                      <View style={styles.attachmentBody}>
                        <Text style={styles.rowTitle}>{attachment.fileName}</Text>
                        <Text style={styles.rowMeta}>{attachment.mimeType}</Text>
                        <Text style={styles.rowMeta}>
                          {(attachment.fileSizeBytes / 1024).toFixed(1)} KB
                        </Text>
                        <Text style={styles.rowMeta}>
                          {attachment.capturedAt
                            ? `Captured ${formatDateTime(attachment.capturedAt)}`
                            : `Uploaded ${formatDateTime(attachment.createdAt)}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const CHECKLIST_STATUS_OPTIONS: ChecklistStatus[] = [
  "pass",
  "fail",
  "not_applicable",
];

const FINDING_SEVERITIES: FindingSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

function createChecklistItems(
  templates: ChecklistTemplateRecord[],
  results: InspectionChecklistResultRecord[],
) {
  if (templates.length === 0) {
    return results.map((result) => ({
      result,
      template: createFallbackTemplate(result),
    }));
  }

  return templates.map((template) => ({
    result: results.find((result) => result.template.id === template.id),
    template,
  }));
}

function createFallbackTemplate(
  result: InspectionChecklistResultRecord,
): ChecklistTemplateRecord {
  return {
    code: result.template.code,
    createdAt: result.createdAt,
    id: result.template.id,
    isActive: true,
    module: result.template.module,
    sortOrder: 0,
    title: result.template.title,
    updatedAt: result.updatedAt,
  };
}

function createChecklistDrafts(
  templates: ChecklistTemplateRecord[],
  results: InspectionChecklistResultRecord[],
): Record<string, ChecklistDraft> {
  return createChecklistItems(templates, results).reduce<
    Record<string, ChecklistDraft>
  >((drafts, item) => {
    drafts[item.template.id] = {
      remarks: item.result?.remarks ?? "",
      status: item.result?.status ?? "pass",
    };

    return drafts;
  }, {});
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function resolveAttachmentFileName(
  asset: ImagePicker.ImagePickerAsset,
  source: "camera" | "library",
) {
  if (asset.fileName?.trim()) {
    return asset.fileName;
  }

  const extension = asset.mimeType?.split("/")[1] || "jpg";

  return `${source}-${Date.now()}.${extension}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xxl,
  },
  card: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  heroCard: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: COLORS.primaryMuted,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.surface,
  },
  heroBody: {
    fontSize: 15,
    color: COLORS.primaryMuted,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: COLORS.text,
  },
  sectionBody: {
    fontSize: 14,
    color: COLORS.mutedText,
    lineHeight: 20,
  },
  rowItem: {
    borderRadius: 18,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    gap: SPACING.xs,
  },
  actionRow: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  flexButton: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  rowMeta: {
    fontSize: 14,
    color: COLORS.mutedText,
    lineHeight: 20,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  stateBody: {
    fontSize: 14,
    color: COLORS.mutedText,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
  },
  multilineInput: {
    minHeight: 104,
    textAlignVertical: "top",
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  segmentButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  segmentButtonLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  segmentButtonLabelActive: {
    color: COLORS.surface,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    backgroundColor: COLORS.secondary,
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.surface,
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    backgroundColor: COLORS.primaryMuted,
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  attachmentHeaderRow: {
    flexDirection: "row",
    gap: SPACING.md,
    alignItems: "center",
  },
  attachmentPreviewShell: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryMuted,
  },
  attachmentPreviewLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 1,
  },
  attachmentBody: {
    flex: 1,
    gap: SPACING.xs,
  },
  syncCard: {
    borderRadius: 18,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    gap: SPACING.sm,
  },
  syncTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  queuedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: 16,
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  queuedBody: {
    flex: 1,
    gap: SPACING.xs,
  },
  inlineButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    lineHeight: 20,
  },
});

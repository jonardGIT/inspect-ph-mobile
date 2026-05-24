import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  AppButton,
  AppChoicePill,
  AppHero,
  AppMessage,
  AppRecordCard,
  AppScreen,
  AppStateCard,
  AppText,
  AppTextField,
  InfoRow,
  SectionHeading,
  StatusBadge,
  SurfaceCard,
} from "@/components/mobile-ui";
import SyncStatusBar from "@/components/sync-status-bar";
import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  ApiRequestError,
  createInspectionFinding,
  getFireSafetyCertificateByInspection,
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
  FireSafetyCertificateRecord,
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
  const isInspector = session?.user.role === "inspector";
  const isRouteBlocked = Boolean(session) && !isInspector;
  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  const [fireSafetyCertificate, setFireSafetyCertificate] =
    useState<FireSafetyCertificateRecord | null>(null);
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
  const [findingPhotoAsset, setFindingPhotoAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isCapturingFindingPhoto, setIsCapturingFindingPhoto] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [findingError, setFindingError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [isCreatingFinding, setIsCreatingFinding] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [retryingFindingId, setRetryingFindingId] = useState<string | null>(
    null,
  );
  const [retryingAttachmentId, setRetryingAttachmentId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCertificate, setIsLoadingCertificate] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  function resetFindingDraft() {
    setFindingTitle("");
    setFindingDescription("");
    setFindingCorrectiveAction("");
    setFindingSeverity("medium");
    setFindingPhotoAsset(null);
  }

  useEffect(() => {
    if (!accessToken) {
      router.replace("/");
      return;
    }

    if (!isInspector) {
      setError("This mobile route is only available to inspector accounts.");
      setIsLoading(false);
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
      const nextQueuedAttachments =
        await listQueuedAttachmentUploads(inspectionId);

      if (!isCancelled) {
        setQueuedAttachments(nextQueuedAttachments);
      }
    }

    async function loadInspectionWorkspace() {
      setIsLoading(true);
      setError(null);
      setCertificateError(null);
      setIsLoadingCertificate(true);

      try {
        const loadCertificate = async () => {
          try {
            return {
              certificate: await getFireSafetyCertificateByInspection(
                token,
                inspectionId,
              ),
              errorMessage: null,
            };
          } catch (loadError) {
            if (loadError instanceof ApiRequestError) {
              if (loadError.status === 401) {
                throw loadError;
              }

              if (loadError.status === 404) {
                return {
                  certificate: null,
                  errorMessage: null,
                };
              }
            }

            return {
              certificate: null,
              errorMessage:
                loadError instanceof Error
                  ? loadError.message
                  : "Unable to load the FireGuard certificate.",
            };
          }
        };

        const [
          detail,
          certificateResult,
          nextChecklistResults,
          nextFindings,
          nextAttachments,
        ] = await Promise.all([
          getInspectionDetail(token, inspectionId),
          loadCertificate(),
          listInspectionChecklistResults(token, inspectionId),
          listInspectionFindings(token, inspectionId),
          listInspectionAttachments(token, inspectionId),
        ]);

        const moduleCode = detail.moduleCode ?? detail.office.moduleCodes[0];
        const nextChecklistTemplates = await listChecklistTemplates(
          token,
          moduleCode,
        );

        if (isCancelled) {
          return;
        }

        setInspection(detail);
        setFireSafetyCertificate(certificateResult.certificate);
        setCertificateError(certificateResult.errorMessage);
        setChecklistTemplates(nextChecklistTemplates);
        setChecklistResults(nextChecklistResults);
        setFindings(nextFindings);
        setAttachments(nextAttachments);
        setChecklistDrafts(
          createChecklistDrafts(nextChecklistTemplates, nextChecklistResults),
        );
        setIsStale(false);
        await AsyncStorage.setItem(
          `inspection:${inspectionId}`,
          JSON.stringify(detail),
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
          const cachedRaw = await AsyncStorage.getItem(
            `inspection:${inspectionId}`,
          );

          if (cachedRaw) {
            try {
              const cachedDetail = JSON.parse(cachedRaw) as InspectionRecord;

              setInspection(cachedDetail);
              setIsStale(true);
              setError(null);
            } catch {
              const errorMessage =
                loadError instanceof Error
                  ? loadError.message
                  : "Unable to load inspection details.";

              setError(errorMessage);
            }
          } else {
            const errorMessage =
              loadError instanceof Error
                ? loadError.message
                : "Unable to load inspection details.";

            setError(errorMessage);
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setIsLoadingCertificate(false);
        }
      }
    }

    void loadInspectionWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, inspectionId, isInspector, router, signOut]);

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

  async function handleCaptureFindingPhoto() {
    setIsCapturingFindingPhoto(true);
    setFindingError(null);
    try {
      const asset = await pickAttachment("camera");
      if (asset) {
        setFindingPhotoAsset(asset);
      }
    } catch (photoError) {
      setFindingError(
        photoError instanceof Error
          ? photoError.message
          : "Unable to capture photo.",
      );
    } finally {
      setIsCapturingFindingPhoto(false);
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

    let queuedFinding: {
      accuracyMeters?: number;
      correctiveAction?: string;
      description: string;
      inspectionId: string;
      latitude?: number;
      longitude?: number;
      severity: FindingSeverity;
      title: string;
    } | null = null;

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

      // Upload evidence photo as an attachment if one was captured
      if (findingPhotoAsset) {
        const photoToUpload = findingPhotoAsset;
        const location = await withLocationCapture().catch(() => ({}));
        const uploadPayload = {
          capturedAt: new Date().toISOString(),
          fileName: resolveAttachmentFileName(photoToUpload, "camera"),
          inspectionId,
          mimeType: photoToUpload.mimeType || "image/jpeg",
          uri: photoToUpload.uri,
          ...location,
        };
        try {
          const attachment = await uploadInspectionAttachment({
            accessToken,
            file: uploadPayload,
            inspectionId,
          });
          setAttachments((current) => [attachment, ...current]);
        } catch {
          // Enqueue for retry if upload fails
          const queued = await enqueueAttachmentUpload(uploadPayload);
          setQueuedAttachments((current) => [queued, ...current]);
        }
      }

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

        setQueuedFindings((currentFindings) => [
          queuedItem,
          ...currentFindings,
        ]);
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
        ...(typeof item.latitude === "number"
          ? { latitude: item.latitude }
          : {}),
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
      throw new Error(
        "Photo library permission is required to attach evidence.",
      );
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

    let queuedUpload: {
      accuracyMeters?: number;
      capturedAt: string;
      fileName: string;
      inspectionId: string;
      latitude?: number;
      longitude?: number;
      mimeType: string;
      uri: string;
    } | null = null;

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

      setAttachments((currentAttachments) => [
        attachment,
        ...currentAttachments,
      ]);
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
          ...(typeof item.latitude === "number"
            ? { latitude: item.latitude }
            : {}),
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
      setAttachments((currentAttachments) => [
        attachment,
        ...currentAttachments,
      ]);
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
  const showFireSafetyCertificateCard =
    Boolean(fireSafetyCertificate) ||
    Boolean(certificateError) ||
    Boolean(inspection?.office.moduleCodes.includes("FIRE"));

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {isLoading ? (
        <AppStateCard
          description="Pulling assigned field data."
          loading
          title="Loading inspection"
        />
      ) : null}

      {!isLoading && error ? (
        <AppStateCard
          action={
            isRouteBlocked ? (
              <AppButton
                fullWidth
                label="Back to mobile home"
                onPress={() => {
                  router.replace("/");
                }}
              />
            ) : null
          }
          description={error}
          title="Inspection unavailable"
          tone="accent"
        />
      ) : null}

      {!isLoading && !error && inspection ? (
        <>
          {isStale ? (
            <View style={styles.staleBanner}>
              <AppText
                size="label"
                style={styles.staleBannerText}
                weight="semibold"
              >
                Offline — showing last cached data
              </AppText>
            </View>
          ) : null}
          <SyncStatusBar />
          <AppHero
            eyebrow="Inspection detail"
            title={inspection.business.businessName}
            description={`Permit ${inspection.permit.permitNumber} · Scheduled ${formatDateTime(inspection.scheduledAt)}`}
            trailing={
              <StatusBadge
                label={inspection.status.replace("_", " ")}
                tone={getStatusTone(inspection.status)}
              />
            }
          />

          <SurfaceCard tone="muted">
            <SectionHeading
              title="Inspection summary"
              description={inspection.notes?.trim() || "No field notes yet."}
            />
            <InfoRow
              label="Office"
              value={`${inspection.office.name} · ${inspection.office.code}`}
            />
            <InfoRow
              label="Scheduled"
              value={formatDateTime(inspection.scheduledAt)}
            />
            <InfoRow label="Permit" value={inspection.permit.permitNumber} />
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeading
              title="Field actions"
              description="Advance the inspection state with live GPS capture from the device."
            />
            <View style={styles.actionRow}>
              {inspection.status === "scheduled" ? (
                <AppButton
                  disabled={isUpdatingStatus}
                  fullWidth
                  label="Start inspection"
                  loading={isUpdatingStatus}
                  onPress={() => {
                    void handleStatusAdvance("in_progress");
                  }}
                />
              ) : null}
              {inspection.status === "in_progress" ? (
                <AppButton
                  disabled={isUpdatingStatus}
                  fullWidth
                  label="Complete inspection"
                  loading={isUpdatingStatus}
                  onPress={() => {
                    void handleStatusAdvance("completed");
                  }}
                />
              ) : null}
            </View>
            {statusError ? (
              <AppMessage message={statusError} tone="danger" />
            ) : null}
          </SurfaceCard>

          <SurfaceCard tone="muted">
            <SectionHeading
              title="Geo capture"
              description={
                inspection.location
                  ? `${inspection.location.latitude.toFixed(5)}, ${inspection.location.longitude.toFixed(5)}${inspection.location.accuracyMeters ? ` · ${inspection.location.accuracyMeters}m accuracy` : ""}`
                  : "No location captured yet for this inspection."
              }
            />
          </SurfaceCard>

          {showFireSafetyCertificateCard ? (
            <SurfaceCard>
              <SectionHeading
                title="Fire safety certificate"
                description="Current FireGuard certificate linked to this inspection, when available."
              />
              {isLoadingCertificate ? (
                <AppText size="label" style={styles.sectionBody} tone="subtle">
                  Loading the current FireGuard certificate.
                </AppText>
              ) : null}
              {certificateError ? (
                <AppMessage message={certificateError} tone="danger" />
              ) : null}
              {!isLoadingCertificate &&
              !certificateError &&
              !fireSafetyCertificate ? (
                <AppText size="label" style={styles.sectionBody} tone="subtle">
                  No fire safety certificate has been issued for this inspection
                  yet.
                </AppText>
              ) : null}
              {fireSafetyCertificate ? (
                <AppRecordCard
                  title={fireSafetyCertificate.certificateNumber}
                  trailing={
                    <StatusBadge
                      label={fireSafetyCertificate.status.replace("_", " ")}
                      tone={getCertificateTone(fireSafetyCertificate.status)}
                    />
                  }
                >
                  <InfoRow
                    label="Issued"
                    value={formatDateTime(fireSafetyCertificate.issuedAt)}
                  />
                  <InfoRow
                    label="Expires"
                    value={formatDateTime(fireSafetyCertificate.expiresAt)}
                  />
                  <InfoRow
                    label="Permit"
                    value={fireSafetyCertificate.inspection.permit.permitNumber}
                  />
                  {fireSafetyCertificate.remarks ? (
                    <AppText
                      size="label"
                      style={styles.sectionBody}
                      tone="subtle"
                    >
                      {fireSafetyCertificate.remarks}
                    </AppText>
                  ) : null}
                </AppRecordCard>
              ) : null}
            </SurfaceCard>
          ) : null}

          <SurfaceCard>
            <SectionHeading
              title="Checklist"
              description="Save each checkpoint as you work. Existing results stay editable."
            />
            {checklistError ? (
              <AppMessage message={checklistError} tone="danger" />
            ) : null}
            {checklistItems.length === 0 ? (
              <AppText size="label" style={styles.sectionBody} tone="subtle">
                No checklist responses yet.
              </AppText>
            ) : (
              checklistItems.map((item) => {
                const draft = checklistDrafts[item.template.id] ?? {
                  remarks: "",
                  status: "pass" as ChecklistStatus,
                };

                return (
                  <AppRecordCard
                    key={item.template.id}
                    title={item.template.title}
                    trailing={
                      <StatusBadge
                        label={
                          item.result
                            ? item.result.status.replace("_", " ")
                            : "Pending"
                        }
                        tone={
                          item.result
                            ? getChecklistTone(item.result.status)
                            : "default"
                        }
                      />
                    }
                  >
                    <View style={styles.segmentRow}>
                      {CHECKLIST_STATUS_OPTIONS.map((option) => (
                        <AppChoicePill
                          key={option}
                          label={option.replace("_", " ")}
                          selected={draft.status === option}
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
                        />
                      ))}
                    </View>
                    <AppTextField
                      multiline
                      placeholder="Inspector remarks"
                      value={draft.remarks}
                      onChangeText={(value) => {
                        setChecklistDrafts((currentDrafts) => ({
                          ...currentDrafts,
                          [item.template.id]: {
                            remarks: value,
                            status:
                              currentDrafts[item.template.id]?.status ?? "pass",
                          },
                        }));
                      }}
                    />
                    <AppButton
                      disabled={savingTemplateId === item.template.id}
                      fullWidth
                      loading={savingTemplateId === item.template.id}
                      onPress={() => {
                        void handleChecklistSave(item.template);
                      }}
                      label="Save checklist item"
                      tone="secondary"
                    />
                  </AppRecordCard>
                );
              })
            )}
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeading
              title="Findings"
              description="Record field issues with severity and optional corrective action."
            />
            {/* Photo-first: capture evidence before filling the form */}
            <AppButton
              disabled={isCapturingFindingPhoto || isCreatingFinding}
              fullWidth
              label={
                findingPhotoAsset
                  ? "Evidence photo captured — retake"
                  : "Capture evidence photo (optional)"
              }
              loading={isCapturingFindingPhoto}
              onPress={() => {
                void handleCaptureFindingPhoto();
              }}
              tone={findingPhotoAsset ? "secondary" : "primary"}
            />
            <AppTextField
              label="Finding title"
              placeholder="Finding title"
              value={findingTitle}
              onChangeText={setFindingTitle}
            />
            <AppTextField
              label="Finding description"
              multiline
              placeholder="Finding description"
              value={findingDescription}
              onChangeText={setFindingDescription}
            />
            <AppTextField
              label="Corrective action"
              placeholder="Corrective action"
              value={findingCorrectiveAction}
              onChangeText={setFindingCorrectiveAction}
            />
            <View style={styles.segmentRow}>
              {FINDING_SEVERITIES.map((severity) => (
                <AppChoicePill
                  key={severity}
                  label={severity}
                  selected={findingSeverity === severity}
                  onPress={() => {
                    setFindingSeverity(severity);
                  }}
                />
              ))}
            </View>
            <AppButton
              disabled={isCreatingFinding}
              fullWidth
              label="Create finding with GPS"
              loading={isCreatingFinding}
              onPress={() => {
                void handleCreateFinding();
              }}
            />
            {findingError ? (
              <AppMessage message={findingError} tone="danger" />
            ) : null}
            {queuedFindings.length > 0 ? (
              <SurfaceCard tone="muted" style={styles.nestedCard}>
                <SectionHeading
                  title="Sync status"
                  description={`${queuedFindings.length} finding${queuedFindings.length === 1 ? "" : "s"} waiting for retry.`}
                />
                <AppButton
                  disabled={Boolean(retryingFindingId)}
                  fullWidth
                  label="Retry pending findings"
                  loading={Boolean(retryingFindingId)}
                  onPress={() => {
                    void handleRetryAllQueuedFindings();
                  }}
                  tone="secondary"
                />
                {queuedFindings.map((item) => (
                  <AppRecordCard
                    key={item.id}
                    style={styles.queuedRow}
                    title={item.title}
                    trailing={
                      <AppButton
                        disabled={retryingFindingId === item.id}
                        label="Retry"
                        loading={retryingFindingId === item.id}
                        onPress={() => {
                          void handleRetryQueuedFinding(item);
                        }}
                        tone="secondary"
                      />
                    }
                  >
                    <AppText size="label" style={styles.rowMeta} tone="subtle">
                      {item.status === "pending"
                        ? "Pending sync"
                        : "Retry failed"}{" "}
                      · Attempt {item.retryCount + 1}
                    </AppText>
                    <AppText size="label" style={styles.rowMeta} tone="subtle">
                      Severity {item.severity} · Queued{" "}
                      {formatDateTime(item.queuedAt)}
                    </AppText>
                    {item.lastError ? (
                      <AppText
                        size="label"
                        style={styles.errorText}
                        tone="danger"
                      >
                        {item.lastError}
                      </AppText>
                    ) : null}
                  </AppRecordCard>
                ))}
              </SurfaceCard>
            ) : null}
            {findings.length === 0 ? (
              <AppText size="label" style={styles.sectionBody} tone="subtle">
                No findings recorded yet.
              </AppText>
            ) : (
              findings.map((finding) => (
                <AppRecordCard
                  key={finding.id}
                  title={finding.title}
                  trailing={
                    <StatusBadge
                      label={finding.severity}
                      tone={getSeverityTone(finding.severity)}
                    />
                  }
                >
                  <AppText size="label" style={styles.rowMeta} tone="subtle">
                    {finding.resolvedAt ? "Resolved" : "Open"}
                  </AppText>
                  <AppText size="label" style={styles.rowMeta} tone="subtle">
                    {finding.description}
                  </AppText>
                  {finding.correctiveAction ? (
                    <AppText
                      size="label"
                      style={styles.sectionBody}
                      tone="subtle"
                    >
                      Corrective action: {finding.correctiveAction}
                    </AppText>
                  ) : null}
                </AppRecordCard>
              ))
            )}
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeading
              title="Attachments"
              description="Capture evidence photos in the field or attach them from the device library."
            />
            {queuedAttachments.length > 0 ? (
              <SurfaceCard tone="muted" style={styles.nestedCard}>
                <SectionHeading
                  title="Sync status"
                  description={`${queuedAttachments.length} attachment${queuedAttachments.length === 1 ? "" : "s"} waiting for retry.`}
                />
                <AppButton
                  disabled={Boolean(retryingAttachmentId)}
                  fullWidth
                  label="Retry pending uploads"
                  loading={Boolean(retryingAttachmentId)}
                  onPress={() => {
                    void handleRetryAllQueuedAttachments();
                  }}
                  tone="secondary"
                />
                {queuedAttachments.map((item) => (
                  <AppRecordCard
                    key={item.id}
                    style={styles.queuedRow}
                    title={item.fileName}
                    trailing={
                      <AppButton
                        disabled={retryingAttachmentId === item.id}
                        label="Retry"
                        loading={retryingAttachmentId === item.id}
                        onPress={() => {
                          void handleRetryQueuedAttachment(item);
                        }}
                        tone="secondary"
                      />
                    }
                  >
                    <AppText size="label" style={styles.rowMeta} tone="subtle">
                      {item.status === "pending"
                        ? "Pending sync"
                        : "Retry failed"}{" "}
                      · Attempt {item.retryCount + 1}
                    </AppText>
                    <AppText size="label" style={styles.rowMeta} tone="subtle">
                      Queued {formatDateTime(item.queuedAt)}
                    </AppText>
                    {item.lastError ? (
                      <AppText
                        size="label"
                        style={styles.errorText}
                        tone="danger"
                      >
                        {item.lastError}
                      </AppText>
                    ) : null}
                  </AppRecordCard>
                ))}
              </SurfaceCard>
            ) : null}
            <View style={styles.buttonRow}>
              <AppButton
                disabled={isUploadingAttachment}
                label="Capture photo"
                loading={isUploadingAttachment}
                onPress={() => {
                  void handleAttachmentUpload("camera");
                }}
                style={styles.rowButton}
              />
              <AppButton
                disabled={isUploadingAttachment}
                label="Attach from library"
                onPress={() => {
                  void handleAttachmentUpload("library");
                }}
                style={styles.rowButton}
                tone="secondary"
              />
            </View>
            {attachmentError ? (
              <AppMessage message={attachmentError} tone="danger" />
            ) : null}
            {attachments.length === 0 ? (
              <AppText size="label" style={styles.sectionBody} tone="subtle">
                No attachments uploaded for this inspection yet.
              </AppText>
            ) : (
              attachments.map((attachment) => (
                <AppRecordCard
                  key={attachment.id}
                  title={attachment.fileName}
                  trailing={
                    <View style={styles.attachmentPreviewShell}>
                      <AppText
                        size="body"
                        style={styles.attachmentPreviewLabel}
                        weight="heavy"
                      >
                        IMG
                      </AppText>
                    </View>
                  }
                >
                  <AppText size="label" style={styles.rowMeta} tone="subtle">
                    {attachment.mimeType}
                  </AppText>
                  <AppText size="label" style={styles.rowMeta} tone="subtle">
                    {(attachment.fileSizeBytes / 1024).toFixed(1)} KB
                  </AppText>
                  <AppText size="label" style={styles.rowMeta} tone="subtle">
                    {attachment.capturedAt
                      ? `Captured ${formatDateTime(attachment.capturedAt)}`
                      : `Uploaded ${formatDateTime(attachment.createdAt)}`}
                  </AppText>
                </AppRecordCard>
              ))
            )}
          </SurfaceCard>
        </>
      ) : null}
    </AppScreen>
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
    version: 1,
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

function getChecklistTone(status: ChecklistStatus) {
  if (status === "pass") {
    return "success" as const;
  }

  if (status === "fail") {
    return "danger" as const;
  }

  return "default" as const;
}

function getSeverityTone(severity: FindingSeverity) {
  if (severity === "critical" || severity === "high") {
    return "danger" as const;
  }

  if (severity === "medium") {
    return "warning" as const;
  }

  return "info" as const;
}

function getCertificateTone(status: FireSafetyCertificateRecord["status"]) {
  if (status === "expired" || status === "revoked") {
    return "danger" as const;
  }

  if (status === "issued") {
    return "success" as const;
  }

  return "warning" as const;
}

const styles = StyleSheet.create({
  staleBanner: {
    backgroundColor: COLORS.accentMuted,
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  staleBannerText: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.label,
    textAlign: "center",
  },
  content: {
    paddingTop: SPACING.lg,
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xxl,
  },
  sectionBody: {
    fontSize: TYPOGRAPHY.label,
    color: COLORS.textSubtle,
    lineHeight: 20,
  },
  actionRow: {
    gap: SPACING.sm,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  rowButton: {
    flex: 1,
    minWidth: 148,
  },
  rowTitle: {
    fontSize: TYPOGRAPHY.body,
    fontWeight: "800",
    color: COLORS.text,
  },
  rowMeta: {
    fontSize: TYPOGRAPHY.label,
    color: COLORS.textSubtle,
    lineHeight: 20,
  },
  stateTitle: {
    fontSize: TYPOGRAPHY.title,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },
  stateBody: {
    fontSize: TYPOGRAPHY.label,
    color: COLORS.textSubtle,
    lineHeight: 20,
    textAlign: "center",
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
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
  nestedCard: {
    padding: SPACING.md,
  },
  queuedRow: {
    backgroundColor: COLORS.surfaceRaised,
    padding: SPACING.sm,
  },
  errorText: {
    fontSize: TYPOGRAPHY.label,
    color: COLORS.danger,
    lineHeight: 20,
  },
});

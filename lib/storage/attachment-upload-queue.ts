import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FindingRecord } from "../../../shared/types/api";

export type QueuedAttachmentUploadStatus = "pending" | "failed";

export type QueuedChecklistResultStatus = "pending" | "failed";

export interface QueuedAttachmentUpload {
  accuracyMeters?: number;
  capturedAt?: string;
  fileName: string;
  id: string;
  inspectionId: string;
  lastError?: string;
  latitude?: number;
  longitude?: number;
  mimeType: string;
  queuedAt: string;
  retryCount: number;
  status: QueuedAttachmentUploadStatus;
  uri: string;
}

export interface QueuedChecklistResult {
  id: string;
  inspectionId: string;
  lastError?: string;
  queuedAt: string;
  remarks?: string;
  retryCount: number;
  status: QueuedChecklistResultStatus;
  templateId: string;
  templateTitle: string;
  value: FindingRecord["severity"] extends never
    ? never
    : "pass" | "fail" | "not_applicable";
}

const ATTACHMENT_UPLOAD_QUEUE_KEY = "inspect-ph-mobile-attachment-upload-queue";
const MAX_QUEUED_ATTACHMENTS = 20;
const CHECKLIST_RESULT_QUEUE_KEY = "inspect-ph-mobile-checklist-result-queue";
const MAX_QUEUED_CHECKLIST_RESULTS = 50;

async function readQueue(): Promise<QueuedAttachmentUpload[]> {
  const rawValue = await AsyncStorage.getItem(ATTACHMENT_UPLOAD_QUEUE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as QueuedAttachmentUpload[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    await AsyncStorage.removeItem(ATTACHMENT_UPLOAD_QUEUE_KEY);
    return [];
  }
}

async function writeQueue(queue: QueuedAttachmentUpload[]) {
  await AsyncStorage.setItem(
    ATTACHMENT_UPLOAD_QUEUE_KEY,
    JSON.stringify(queue),
  );
}

async function readChecklistQueue(): Promise<QueuedChecklistResult[]> {
  const rawValue = await AsyncStorage.getItem(CHECKLIST_RESULT_QUEUE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as QueuedChecklistResult[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    await AsyncStorage.removeItem(CHECKLIST_RESULT_QUEUE_KEY);
    return [];
  }
}

async function writeChecklistQueue(queue: QueuedChecklistResult[]) {
  await AsyncStorage.setItem(CHECKLIST_RESULT_QUEUE_KEY, JSON.stringify(queue));
}

export async function listQueuedChecklistResults(inspectionId: string) {
  const queue = await readChecklistQueue();

  return queue.filter((item) => item.inspectionId === inspectionId);
}

export async function enqueueChecklistResult(
  input: Omit<
    QueuedChecklistResult,
    "id" | "queuedAt" | "retryCount" | "status"
  >,
) {
  const queue = await readChecklistQueue();
  const nextItem: QueuedChecklistResult = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    inspectionId: input.inspectionId,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    status: "pending",
    templateId: input.templateId,
    templateTitle: input.templateTitle,
    value: input.value,
    ...(typeof input.remarks === "string" ? { remarks: input.remarks } : {}),
  };

  const dedupedQueue = queue.filter(
    (item) =>
      !(
        item.inspectionId === input.inspectionId &&
        item.templateId === input.templateId
      ),
  );
  const nextQueue = [nextItem, ...dedupedQueue].slice(
    0,
    MAX_QUEUED_CHECKLIST_RESULTS,
  );

  await writeChecklistQueue(nextQueue);

  return nextItem;
}

export async function markQueuedChecklistResultFailed(
  id: string,
  lastError: string,
) {
  const queue = await readChecklistQueue();
  const nextQueue = queue.map((item) =>
    item.id === id
      ? {
          ...item,
          lastError,
          retryCount: item.retryCount + 1,
          status: "failed" as const,
        }
      : item,
  );

  await writeChecklistQueue(nextQueue);

  return nextQueue;
}

export async function markQueuedChecklistResultPending(id: string) {
  const queue = await readChecklistQueue();
  const nextQueue = queue.map((item) =>
    item.id === id
      ? (() => {
          const { lastError: _lastError, ...rest } = item;

          return {
            ...rest,
            status: "pending" as const,
          };
        })()
      : item,
  );

  await writeChecklistQueue(nextQueue);

  return nextQueue;
}

export async function removeQueuedChecklistResult(id: string) {
  const queue = await readChecklistQueue();
  const nextQueue = queue.filter((item) => item.id !== id);

  await writeChecklistQueue(nextQueue);

  return nextQueue;
}

export async function listQueuedAttachmentUploads(inspectionId: string) {
  const queue = await readQueue();

  return queue.filter((item) => item.inspectionId === inspectionId);
}

export async function enqueueAttachmentUpload(
  input: Omit<
    QueuedAttachmentUpload,
    "id" | "queuedAt" | "retryCount" | "status"
  >,
) {
  const queue = await readQueue();
  const nextItem: QueuedAttachmentUpload = {
    fileName: input.fileName,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    inspectionId: input.inspectionId,
    mimeType: input.mimeType,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    status: "pending",
    uri: input.uri,
    ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}),
    ...(typeof input.latitude === "number" ? { latitude: input.latitude } : {}),
    ...(typeof input.longitude === "number"
      ? { longitude: input.longitude }
      : {}),
    ...(typeof input.accuracyMeters === "number"
      ? { accuracyMeters: input.accuracyMeters }
      : {}),
  };
  const nextQueue = [nextItem, ...queue].slice(0, MAX_QUEUED_ATTACHMENTS);

  await writeQueue(nextQueue);

  return nextItem;
}

export async function markQueuedAttachmentUploadFailed(
  id: string,
  lastError: string,
) {
  const queue = await readQueue();
  const nextQueue = queue.map((item) =>
    item.id === id
      ? {
          ...item,
          lastError,
          retryCount: item.retryCount + 1,
          status: "failed" as const,
        }
      : item,
  );

  await writeQueue(nextQueue);

  return nextQueue;
}

export async function markQueuedAttachmentUploadPending(id: string) {
  const queue = await readQueue();
  const nextQueue = queue.map((item) =>
    item.id === id
      ? (() => {
          const { lastError: _lastError, ...rest } = item;

          return {
            ...rest,
            status: "pending" as const,
          };
        })()
      : item,
  );

  await writeQueue(nextQueue);

  return nextQueue;
}

export async function removeQueuedAttachmentUpload(id: string) {
  const queue = await readQueue();
  const nextQueue = queue.filter((item) => item.id !== id);

  await writeQueue(nextQueue);

  return nextQueue;
}

export type QueuedFindingCreateStatus = "pending" | "failed";

export interface QueuedFindingCreate {
  accuracyMeters?: number;
  correctiveAction?: string;
  description: string;
  id: string;
  inspectionId: string;
  lastError?: string;
  latitude?: number;
  longitude?: number;
  queuedAt: string;
  retryCount: number;
  severity: FindingRecord["severity"];
  status: QueuedFindingCreateStatus;
  title: string;
}

const FINDING_CREATE_QUEUE_KEY = "inspect-ph-mobile-finding-create-queue";
const MAX_QUEUED_FINDINGS = 20;

async function readFindingQueue(): Promise<QueuedFindingCreate[]> {
  const rawValue = await AsyncStorage.getItem(FINDING_CREATE_QUEUE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as QueuedFindingCreate[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    await AsyncStorage.removeItem(FINDING_CREATE_QUEUE_KEY);
    return [];
  }
}

async function writeFindingQueue(queue: QueuedFindingCreate[]) {
  await AsyncStorage.setItem(FINDING_CREATE_QUEUE_KEY, JSON.stringify(queue));
}

export async function listQueuedFindingCreates(inspectionId: string) {
  const queue = await readFindingQueue();

  return queue.filter((item) => item.inspectionId === inspectionId);
}

export async function enqueueFindingCreate(
  input: Omit<QueuedFindingCreate, "id" | "queuedAt" | "retryCount" | "status">,
) {
  const queue = await readFindingQueue();
  const nextItem: QueuedFindingCreate = {
    description: input.description,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    inspectionId: input.inspectionId,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    severity: input.severity,
    status: "pending",
    title: input.title,
    ...(input.correctiveAction
      ? { correctiveAction: input.correctiveAction }
      : {}),
    ...(typeof input.latitude === "number" ? { latitude: input.latitude } : {}),
    ...(typeof input.longitude === "number"
      ? { longitude: input.longitude }
      : {}),
    ...(typeof input.accuracyMeters === "number"
      ? { accuracyMeters: input.accuracyMeters }
      : {}),
  };
  const nextQueue = [nextItem, ...queue].slice(0, MAX_QUEUED_FINDINGS);

  await writeFindingQueue(nextQueue);

  return nextItem;
}

export async function markQueuedFindingCreateFailed(
  id: string,
  lastError: string,
) {
  const queue = await readFindingQueue();
  const nextQueue = queue.map((item) =>
    item.id === id
      ? {
          ...item,
          lastError,
          retryCount: item.retryCount + 1,
          status: "failed" as const,
        }
      : item,
  );

  await writeFindingQueue(nextQueue);

  return nextQueue;
}

export async function markQueuedFindingCreatePending(id: string) {
  const queue = await readFindingQueue();
  const nextQueue = queue.map((item) =>
    item.id === id
      ? (() => {
          const { lastError: _lastError, ...rest } = item;

          return {
            ...rest,
            status: "pending" as const,
          };
        })()
      : item,
  );

  await writeFindingQueue(nextQueue);

  return nextQueue;
}

export async function removeQueuedFindingCreate(id: string) {
  const queue = await readFindingQueue();
  const nextQueue = queue.filter((item) => item.id !== id);

  await writeFindingQueue(nextQueue);

  return nextQueue;
}
export async function countAllPendingQueueItems(): Promise<number> {
  const [attachments, findings, checklistResults] = await Promise.all([
    readQueue(),
    readFindingQueue(),
    readChecklistQueue(),
  ]);

  return (
    checklistResults.filter((item) => item.status === "pending").length +
    attachments.filter((item) => item.status === "pending").length +
    findings.filter((item) => item.status === "pending").length
  );
}

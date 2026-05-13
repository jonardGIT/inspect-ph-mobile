import Constants from "expo-constants";

import type {
  ApiError,
  ApiListResponse,
  ApiResponse,
  AttachmentRecord,
  AttachmentUploadIntent,
  AuthTokens,
  ChecklistTemplateRecord,
  FindingRecord,
  InspectionChecklistResultRecord,
  InspectionRecord,
  InspectionSummary,
  User,
} from "../../shared/types/api";

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

function resolveExpoHost() {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const host = candidate.split("/")[0]?.split(":")[0]?.trim();

    if (host) {
      return host;
    }
  }

  return null;
}

function resolveApiBaseUrl() {
  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configuredApiUrl) {
    return normalizeApiBaseUrl(configuredApiUrl);
  }

  const expoHost = resolveExpoHost();

  if (expoHost) {
    return `http://${expoHost}:4000/api/v1`;
  }

  return "http://localhost:4000/api/v1";
}

const API_BASE_URL = resolveApiBaseUrl();

export interface AuthSession {
  tokens: AuthTokens;
  user: User;
}

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export interface MobileAttachmentUploadFile {
  accuracyMeters?: number;
  capturedAt?: string;
  fileName: string;
  latitude?: number;
  longitude?: number;
  mimeType: string;
  uri: string;
}

function resolveUploadTarget(intent: AttachmentUploadIntent): string {
  if (intent.uploadUrl) {
    return intent.uploadUrl;
  }

  if (intent.uploadPath) {
    return `${API_BASE_URL}${intent.uploadPath.startsWith("/") ? "" : "/"}${intent.uploadPath}`;
  }

  throw new Error("Upload target is missing from the attachment upload intent");
}

async function request<T>(
  path: string,
  init?: RequestInit,
  accessToken?: string,
): Promise<T> {
  const requestUrl = `${API_BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error(
      `Network request failed. Check that the API is reachable at ${API_BASE_URL}.`,
    );
  }

  const payload = (await response.json()) as T & ApiError;

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      payload.error?.message || "The request could not be completed.",
    );
  }

  return payload;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const payload = await request<ApiResponse<AuthSession>>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.data;
}

export async function getInspectionSummary(
  accessToken: string,
): Promise<InspectionSummary> {
  const payload = await request<ApiResponse<InspectionSummary>>(
    "/inspections/summary",
    undefined,
    accessToken,
  );

  return payload.data;
}

export async function listInspections(input: {
  accessToken: string;
  limit?: number;
  page?: number;
  status?: InspectionRecord["status"];
}): Promise<ApiListResponse<InspectionRecord>> {
  const params = new URLSearchParams();

  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  if (input.page) {
    params.set("page", String(input.page));
  }

  if (input.status) {
    params.set("status", input.status);
  }

  return request<ApiListResponse<InspectionRecord>>(
    `/inspections${params.toString() ? `?${params.toString()}` : ""}`,
    undefined,
    input.accessToken,
  );
}

export async function getInspectionDetail(
  accessToken: string,
  inspectionId: string,
): Promise<InspectionRecord> {
  const payload = await request<ApiResponse<InspectionRecord>>(
    `/inspections/${inspectionId}`,
    undefined,
    accessToken,
  );

  return payload.data;
}

export async function listInspectionChecklistResults(
  accessToken: string,
  inspectionId: string,
): Promise<InspectionChecklistResultRecord[]> {
  const payload = await request<ApiResponse<InspectionChecklistResultRecord[]>>(
    `/inspections/${inspectionId}/checklist-results`,
    undefined,
    accessToken,
  );

  return payload.data;
}

export async function listInspectionFindings(
  accessToken: string,
  inspectionId: string,
): Promise<FindingRecord[]> {
  const payload = await request<ApiResponse<FindingRecord[]>>(
    `/inspections/${inspectionId}/findings`,
    undefined,
    accessToken,
  );

  return payload.data;
}

export async function listInspectionAttachments(
  accessToken: string,
  inspectionId: string,
): Promise<AttachmentRecord[]> {
  const payload = await request<ApiResponse<AttachmentRecord[]>>(
    `/inspections/${inspectionId}/attachments`,
    undefined,
    accessToken,
  );

  return payload.data;
}

export async function listChecklistTemplates(
  accessToken: string,
  module?: string,
): Promise<ChecklistTemplateRecord[]> {
  const params = new URLSearchParams();

  if (module) {
    params.set("module", module);
  }

  const payload = await request<ApiResponse<ChecklistTemplateRecord[]>>(
    `/inspections/checklist-templates${params.toString() ? `?${params.toString()}` : ""}`,
    undefined,
    accessToken,
  );

  return payload.data;
}

export async function updateInspectionStatus(input: {
  accessToken: string;
  inspectionId: string;
  status: InspectionRecord["status"];
  notes?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}): Promise<InspectionRecord> {
  const payload = await request<ApiResponse<InspectionRecord>>(
    `/inspections/${input.inspectionId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        accuracyMeters: input.accuracyMeters,
        latitude: input.latitude,
        longitude: input.longitude,
        notes: input.notes,
        status: input.status,
      }),
    },
    input.accessToken,
  );

  return payload.data;
}

export async function upsertInspectionChecklistResult(input: {
  accessToken: string;
  inspectionId: string;
  templateId: string;
  status: InspectionChecklistResultRecord["status"];
  remarks?: string;
}): Promise<InspectionChecklistResultRecord> {
  const payload = await request<ApiResponse<InspectionChecklistResultRecord>>(
    `/inspections/${input.inspectionId}/checklist-results/${input.templateId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        remarks: input.remarks,
        status: input.status,
      }),
    },
    input.accessToken,
  );

  return payload.data;
}

export async function createInspectionFinding(input: {
  accessToken: string;
  inspectionId: string;
  severity: FindingRecord["severity"];
  title: string;
  description: string;
  correctiveAction?: string;
  checklistResultId?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}): Promise<FindingRecord> {
  const payload = await request<ApiResponse<FindingRecord>>(
    `/inspections/${input.inspectionId}/findings`,
    {
      method: "POST",
      body: JSON.stringify({
        accuracyMeters: input.accuracyMeters,
        checklistResultId: input.checklistResultId,
        correctiveAction: input.correctiveAction,
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        severity: input.severity,
        title: input.title,
      }),
    },
    input.accessToken,
  );

  return payload.data;
}

export async function createAttachmentUploadIntent(input: {
  accessToken: string;
  fileName: string;
  inspectionId: string;
}): Promise<AttachmentUploadIntent> {
  const payload = await request<ApiResponse<AttachmentUploadIntent>>(
    `/inspections/${input.inspectionId}/attachments/upload-intents`,
    {
      method: "POST",
      body: JSON.stringify({ fileName: input.fileName }),
    },
    input.accessToken,
  );

  return payload.data;
}

export async function createInspectionAttachment(input: {
  accessToken: string;
  accuracyMeters?: number;
  capturedAt?: string;
  fileName: string;
  fileSizeBytes: number;
  inspectionId: string;
  latitude?: number;
  longitude?: number;
  mimeType: string;
  storageKey: string;
}): Promise<AttachmentRecord> {
  const payload = await request<ApiResponse<AttachmentRecord>>(
    `/inspections/${input.inspectionId}/attachments`,
    {
      method: "POST",
      body: JSON.stringify({
        fileName: input.fileName,
        fileSizeBytes: input.fileSizeBytes,
        mimeType: input.mimeType,
        storageKey: input.storageKey,
        ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}),
        ...(typeof input.latitude === "number" ? { latitude: input.latitude } : {}),
        ...(typeof input.longitude === "number" ? { longitude: input.longitude } : {}),
        ...(typeof input.accuracyMeters === "number"
          ? { accuracyMeters: input.accuracyMeters }
          : {}),
      }),
    },
    input.accessToken,
  );

  return payload.data;
}

async function uploadAttachmentBinary(
  intent: AttachmentUploadIntent,
  file: Pick<MobileAttachmentUploadFile, "mimeType" | "uri">,
): Promise<number> {
  const fileResponse = await fetch(file.uri);

  if (!fileResponse.ok) {
    throw new Error("Unable to read the selected attachment.");
  }

  const body = await fileResponse.blob();
  const response = await fetch(resolveUploadTarget(intent), {
    method: intent.uploadMethod,
    headers: {
      ...intent.uploadHeaders,
      "Content-Type": file.mimeType,
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Attachment upload failed.");
  }

  return body.size;
}

export async function uploadInspectionAttachment(input: {
  accessToken: string;
  inspectionId: string;
  file: MobileAttachmentUploadFile;
}): Promise<AttachmentRecord> {
  const intent = await createAttachmentUploadIntent({
    accessToken: input.accessToken,
    fileName: input.file.fileName,
    inspectionId: input.inspectionId,
  });

  const fileSizeBytes = await uploadAttachmentBinary(intent, input.file);

  return createInspectionAttachment({
    accessToken: input.accessToken,
    inspectionId: input.inspectionId,
    fileName: input.file.fileName,
    fileSizeBytes,
    mimeType: input.file.mimeType,
    storageKey: intent.storageKey,
    ...(input.file.capturedAt ? { capturedAt: input.file.capturedAt } : {}),
    ...(typeof input.file.latitude === "number"
      ? { latitude: input.file.latitude }
      : {}),
    ...(typeof input.file.longitude === "number"
      ? { longitude: input.file.longitude }
      : {}),
    ...(typeof input.file.accuracyMeters === "number"
      ? { accuracyMeters: input.file.accuracyMeters }
      : {}),
  });
}

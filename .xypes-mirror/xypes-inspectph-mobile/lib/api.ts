import { API_BASE_URL } from "@/lib/api-base-url";

import type {
  ApiError,
  ApiListResponse,
  ApiResponse,
  AttachmentRecord,
  AttachmentUploadIntent,
  AuthTokens,
  ChecklistTemplateRecord,
  CorrectiveActionPlanRecord,
  CreatePublicIssueReportInput,
  FireSafetyCertificateRecord,
  FindingRecord,
  InspectionChecklistResultRecord,
  InspectionMapPoint,
  InspectionRecord,
  InspectionSummary,
  IssueReportRecord,
  ModuleRecord,
  OfficeModuleRecord,
  PaymentRecord,
  PermitRecord,
  PublicPermitLookupRecord,
  User,
} from "../shared/types/api";

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
      `Network request failed. Could not reach ${requestUrl} — check the API_URL in your .env.local.`,
    );
  }

  const responseText = await response.text();

  if (!responseText) {
    if (!response.ok) {
      throw new ApiRequestError(
        response.status,
        response.statusText || "The request could not be completed.",
      );
    }

    return undefined as T;
  }

  let payload: T & ApiError;
  try {
    payload = JSON.parse(responseText) as T & ApiError;
  } catch {
    if (!response.ok) {
      throw new ApiRequestError(
        response.status,
        response.statusText || "The request could not be completed.",
      );
    }

    throw new Error(
      `Server returned a non-JSON response (HTTP ${response.status}) for ${requestUrl}.`,
    );
  }

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
  officeId?: string,
): Promise<InspectionSummary> {
  const params = new URLSearchParams();

  if (officeId) {
    params.set("officeId", officeId);
  }

  const payload = await request<ApiResponse<InspectionSummary>>(
    `/inspections/summary${params.toString() ? `?${params.toString()}` : ""}`,
    undefined,
    accessToken,
  );

  return payload.data;
}

export async function createPublicIssueReport(
  input: CreatePublicIssueReportInput,
): Promise<IssueReportRecord> {
  const payload = await request<ApiResponse<IssueReportRecord>>(
    "/issue-reports/public",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
}

export async function getPublicIssueReportByNumber(
  reportNumber: string,
): Promise<IssueReportRecord> {
  const payload = await request<ApiResponse<IssueReportRecord>>(
    `/issue-reports/public/${encodeURIComponent(reportNumber)}`,
  );

  return payload.data;
}

export async function listInspections(input: {
  accessToken: string;
  limit?: number;
  officeId?: string;
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

  if (input.officeId) {
    params.set("officeId", input.officeId);
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

export async function listInspectionMapPoints(input: {
  accessToken: string;
  officeId?: string;
  status?: InspectionRecord["status"];
}): Promise<InspectionMapPoint[]> {
  const params = new URLSearchParams();

  if (input.officeId) {
    params.set("officeId", input.officeId);
  }

  if (input.status) {
    params.set("status", input.status);
  }

  const payload = await request<ApiResponse<InspectionMapPoint[]>>(
    `/inspections/map-points${params.toString() ? `?${params.toString()}` : ""}`,
    undefined,
    input.accessToken,
  );

  return payload.data;
}

export async function getFireSafetyCertificateByInspection(
  accessToken: string,
  inspectionId: string,
): Promise<FireSafetyCertificateRecord> {
  const payload = await request<ApiResponse<FireSafetyCertificateRecord>>(
    `/fire-safety-certificates/inspection/${inspectionId}`,
    undefined,
    accessToken,
  );

  return payload.data;
}

export async function listModules(input: {
  accessToken: string;
  isActive?: boolean;
  limit?: number;
  page?: number;
  search?: string;
}): Promise<ApiListResponse<ModuleRecord>> {
  const params = new URLSearchParams();

  if (typeof input.isActive === "boolean") {
    params.set("isActive", String(input.isActive));
  }

  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  if (input.page) {
    params.set("page", String(input.page));
  }

  if (input.search) {
    params.set("search", input.search);
  }

  return request<ApiListResponse<ModuleRecord>>(
    `/modules${params.toString() ? `?${params.toString()}` : ""}`,
    undefined,
    input.accessToken,
  );
}

export async function listOfficeModules(input: {
  accessToken: string;
  limit?: number;
  moduleId?: string;
  officeId?: string;
  page?: number;
}): Promise<ApiListResponse<OfficeModuleRecord>> {
  const params = new URLSearchParams();

  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  if (input.moduleId) {
    params.set("moduleId", input.moduleId);
  }

  if (input.officeId) {
    params.set("officeId", input.officeId);
  }

  if (input.page) {
    params.set("page", String(input.page));
  }

  return request<ApiListResponse<OfficeModuleRecord>>(
    `/office-modules${params.toString() ? `?${params.toString()}` : ""}`,
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
        ...(typeof input.latitude === "number"
          ? { latitude: input.latitude }
          : {}),
        ...(typeof input.longitude === "number"
          ? { longitude: input.longitude }
          : {}),
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

export async function registerPushToken(input: {
  accessToken: string;
  token: string;
}): Promise<void> {
  await request<ApiResponse<unknown>>(
    "/auth/push-token",
    {
      method: "POST",
      body: JSON.stringify({ token: input.token }),
    },
    input.accessToken,
  );
}

export async function requestPermitRenewal(input: {
  accessToken: string;
  businessId: string;
}): Promise<{ permitNumber: string }> {
  const response = await request<ApiResponse<{ permitNumber: string }>>(
    "/permits/renewal-application",
    {
      method: "POST",
      body: JSON.stringify({ businessId: input.businessId }),
    },
    input.accessToken,
  );
  return response.data;
}

export async function listMyCaps(input: {
  accessToken: string;
  page?: number;
  limit?: number;
}): Promise<ApiListResponse<CorrectiveActionPlanRecord>> {
  return request<ApiListResponse<CorrectiveActionPlanRecord>>(
    `/caps/mine?page=${input.page ?? 1}&limit=${input.limit ?? 10}`,
    {},
    input.accessToken,
  );
}

export async function refreshTokens(input: {
  refreshToken: string;
}): Promise<AuthTokens> {
  const response = await request<ApiResponse<AuthTokens>>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: input.refreshToken }),
  });
  return response.data;
}

export async function getPublicPermitByNumber(input: {
  permitNumber: string;
}): Promise<PublicPermitLookupRecord> {
  const response = await request<ApiResponse<PublicPermitLookupRecord>>(
    `/permits/public/${encodeURIComponent(input.permitNumber)}`,
  );
  return response.data;
}

export async function getPublicPaymentByReferenceNumber(input: {
  referenceNumber: string;
}): Promise<PaymentRecord> {
  const response = await request<ApiResponse<PaymentRecord>>(
    `/payments/public/${encodeURIComponent(input.referenceNumber)}`,
  );
  return response.data;
}

export async function register(input: {
  email: string;
  name: string;
  password: string;
  role: "business_owner" | "citizen";
  businessId?: string;
}): Promise<AuthSession> {
  const response = await request<ApiResponse<AuthSession>>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function listOwnPermits(
  accessToken: string,
  params?: { page?: number; limit?: number; status?: string },
): Promise<ApiListResponse<PermitRecord>> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  return request<ApiListResponse<PermitRecord>>(
    `/permits/mine${qs ? `?${qs}` : ""}`,
    {},
    accessToken,
  );
}

export async function listOwnCertificates(
  accessToken: string,
  params?: { page?: number; limit?: number },
): Promise<ApiListResponse<FireSafetyCertificateRecord>> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request<ApiListResponse<FireSafetyCertificateRecord>>(
    `/fire-safety-certificates/mine${qs ? `?${qs}` : ""}`,
    {},
    accessToken,
  );
}

export async function listOwnIssueReports(
  accessToken: string,
  params?: { page?: number; limit?: number },
): Promise<ApiListResponse<IssueReportRecord>> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request<ApiListResponse<IssueReportRecord>>(
    `/issue-reports/mine${qs ? `?${qs}` : ""}`,
    {},
    accessToken,
  );
}

export async function requestReinspection(
  accessToken: string,
  input: { inspectionId: string; reason?: string },
): Promise<{ inspectionId: string }> {
  const response = await request<ApiResponse<{ inspectionId: string }>>(
    `/inspections/${input.inspectionId}/reinspection-request`,
    {
      method: "POST",
      body: JSON.stringify({ reason: input.reason }),
    },
    accessToken,
  );
  return response.data;
}

import Constants from "expo-constants";

const LOCAL_API_BASE_URL = "http://localhost:4000/api/v1";

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

export function resolveApiBaseUrl() {
  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configuredApiUrl) {
    return normalizeApiBaseUrl(configuredApiUrl);
  }

  const preferExpoHost = process.env.EXPO_PUBLIC_USE_EXPO_HOST === "true";

  if (!preferExpoHost) {
    return LOCAL_API_BASE_URL;
  }

  const expoHost = resolveExpoHost();

  if (expoHost) {
    return `http://${expoHost}:4000/api/v1`;
  }

  return LOCAL_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

import Constants from "expo-constants";

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

  const expoHost = resolveExpoHost();

  if (expoHost) {
    return `http://${expoHost}:4000/api/v1`;
  }

  return "http://localhost:4000/api/v1";
}

export const API_BASE_URL = resolveApiBaseUrl();
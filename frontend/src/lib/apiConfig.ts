const LOCAL_API_URL = "http://localhost:8000/api";

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL;

  if (configuredUrl?.trim()) {
    return trimTrailingSlashes(configuredUrl.trim());
  }

  const legacyBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (legacyBaseUrl?.trim()) {
    const normalizedLegacyUrl = trimTrailingSlashes(legacyBaseUrl.trim());

    return normalizedLegacyUrl.endsWith("/api")
      ? normalizedLegacyUrl
      : `${normalizedLegacyUrl}/api`;
  }

  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return "/api";
  }

  return LOCAL_API_URL;
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${getApiBaseUrl()}${normalizedPath}`;
}

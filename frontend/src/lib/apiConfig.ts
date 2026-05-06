const LOCAL_API_URL = "http://localhost:8000/api";
export const UNEXPECTED_BACKEND_RESPONSE_MESSAGE =
  "Unexpected backend response. Check API configuration.";

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL;

  if (configuredUrl?.trim()) {
    return trimTrailingSlashes(configuredUrl.trim());
  }

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return LOCAL_API_URL;
  }

  throw new Error("NEXT_PUBLIC_API_URL is required for production frontend builds.");
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${getApiBaseUrl()}${normalizedPath}`;
}

export async function getApiErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("text/html")) {
    return UNEXPECTED_BACKEND_RESPONSE_MESSAGE;
  }

  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => null);

    if (body && typeof body === "object" && "detail" in body) {
      return String(body.detail);
    }
  }

  const body = await response.text().catch(() => "");

  return body || `Request failed with ${response.status}`;
}

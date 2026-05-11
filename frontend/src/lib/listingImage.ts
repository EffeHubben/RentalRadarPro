import { buildApiUrl } from "@/lib/apiConfig";

const blockedImageHosts = new Set<string>();

const proxiedImageHosts = new Set([
  "images.marktplaats.com",
  "img.marktplaats.com",
  "photos.zah.nl",
  "cdn.ikwilhuren.nu",
  "media.ikwilhuren.nu",
  "images.pararius.nl",
  "img.pararius.nl",
  "images.funda.nl",
  "cloud.funda.nl",
  "api.holland2stay.com",
  "media.holland2stay.com",
]);

const ruleStrippableHosts = new Set(["images.marktplaats.com", "img.marktplaats.com"]);

function safeImageHost(imageUrl: string): string {
  try {
    return new URL(imageUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function upgradeImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.endsWith(".static.nbo.nl") || host === "static.nbo.nl") {
      parsed.hostname = "ikwilhuren.nu";
      parsed.protocol = "https:";
      return parsed.toString();
    }

    if (ruleStrippableHosts.has(host)) {
      parsed.searchParams.delete("rule");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function resolveListingImageUrl(rawImageUrl: string | null | undefined): string {
  const imageUrl = rawImageUrl?.trim() ?? "";

  if (!imageUrl) {
    return "";
  }

  const imageHost = safeImageHost(imageUrl);

  if (
    blockedImageHosts.has(imageHost) ||
    imageUrl.toLowerCase().includes("photo_waiting") ||
    imageUrl.toLowerCase().includes("placeholder")
  ) {
    return "";
  }

  const resolved = upgradeImageUrl(imageUrl);

  if (proxiedImageHosts.has(imageHost)) {
    try {
      return buildApiUrl(`/proxy/image?url=${encodeURIComponent(resolved)}`);
    } catch {
      return "";
    }
  }

  return resolved;
}

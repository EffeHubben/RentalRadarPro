import { buildApiUrl } from "@/lib/apiConfig";

const blockedImageHosts = new Set(["b.static.nbo.nl"]);

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
    if (ruleStrippableHosts.has(parsed.hostname.toLowerCase())) {
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

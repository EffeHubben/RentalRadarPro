import type { MetadataRoute } from "next";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://rentscout.nl").replace(/\/+$/, "");
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api").replace(/\/+$/, "");

type SitemapItem = {
  id: number;
  city: string | null;
  property_type: string;
  updated_at: string;
};

function buildSlug(item: SitemapItem): string {
  const parts: string[] = [String(item.id)];
  if (item.city) {
    parts.push(item.city.toLowerCase().replace(/\s+/g, "-"));
  }
  if (item.property_type && item.property_type !== "unknown") {
    parts.push(item.property_type);
  }
  return parts.join("-");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/search`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${APP_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/refund-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const res = await fetch(`${API_URL}/listings/sitemap`, { next: { revalidate: 3600 } });
    if (!res.ok) return staticRoutes;

    const items = (await res.json()) as SitemapItem[];

    const listingRoutes: MetadataRoute.Sitemap = items.map((item) => ({
      url: `${APP_URL}/listing/${buildSlug(item)}`,
      lastModified: new Date(item.updated_at),
      changeFrequency: "daily",
      priority: 0.7,
    }));

    return [...staticRoutes, ...listingRoutes];
  } catch {
    return staticRoutes;
  }
}

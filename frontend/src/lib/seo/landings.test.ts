import { describe, expect, it } from "vitest";
import {
  buildSeoLandingMetadata,
  getSafePreviewListings,
  getSeoLandingBySlug,
  getSeoLandingStaticParams,
  getSeoSitemapPaths,
} from "./landings";

describe("seo landing routes", () => {
  it("includes all required Dutch city routes", () => {
    const slugs = getSeoLandingStaticParams().map((entry) => entry.landingSlug);
    const required = [
      "huurwoning-breda",
      "huurwoning-rotterdam",
      "huurwoning-utrecht",
      "huurwoning-amsterdam",
      "huurwoning-eindhoven",
      "huurwoning-tilburg",
      "huurwoning-den-haag",
      "huurwoning-groningen",
      "huurwoning-nijmegen",
      "huurwoning-maastricht",
    ];

    for (const slug of required) {
      expect(slugs).toContain(slug);
    }
  });

  it("includes scalable type+city routes", () => {
    const slugs = getSeoLandingStaticParams().map((entry) => entry.landingSlug);
    expect(slugs).toContain("appartement-huren-utrecht");
    expect(slugs).toContain("studio-huren-rotterdam");
    expect(slugs).toContain("kamer-huren-groningen");
  });
});

describe("seo metadata", () => {
  it("builds canonical metadata for a landing page", () => {
    const landing = getSeoLandingBySlug("huurwoning-breda");
    expect(landing).not.toBeNull();
    if (!landing) return;

    const metadata = buildSeoLandingMetadata(landing);
    expect(metadata.title).toBe("Huurwoning Breda | RentScout");
    expect(metadata.description).toContain("Breda");
    expect(metadata.alternates?.canonical).toBe("/huurwoning-breda");
  });
});

describe("safe listing preview", () => {
  it("returns max 10 preview items with only safe fields", () => {
    const landing = getSeoLandingBySlug("appartement-huren-breda");
    expect(landing).not.toBeNull();
    if (!landing) return;

    const preview = getSafePreviewListings(landing.city, landing.ctaSearchFilters.propertyType);
    expect(preview.length).toBeLessThanOrEqual(10);
    expect(preview.length).toBeGreaterThan(0);

    for (const item of preview) {
      expect(Object.keys(item).sort()).toEqual(["city", "location", "price", "propertyType"]);
      expect(typeof item.price).toBe("number");
      expect(typeof item.city).toBe("string");
      expect(typeof item.location).toBe("string");
      expect(["apartment", "room", "studio"]).toContain(item.propertyType);
    }
  });
});

describe("seo sitemap entries", () => {
  it("includes landing paths in sitemap helper output", () => {
    const paths = getSeoSitemapPaths();
    expect(paths).toContain("/huurwoning-breda");
    expect(paths).toContain("/appartement-huren-utrecht");
    expect(paths).toContain("/studio-huren-rotterdam");
    expect(paths).toContain("/kamer-huren-groningen");
  });
});

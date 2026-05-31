import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("contains SEO landing pages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => [],
    } as Response);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://rentscout.nl/huurwoning-breda");
    expect(urls).toContain("https://rentscout.nl/appartement-huren-utrecht");
    expect(urls).toContain("https://rentscout.nl/studio-huren-rotterdam");
    expect(urls).toContain("https://rentscout.nl/kamer-huren-groningen");
  });
});

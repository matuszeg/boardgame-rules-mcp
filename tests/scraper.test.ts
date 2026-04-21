import { describe, it, expect } from "vitest";
import {
  slugToTitle,
  slugToId,
  buildIndex,
  fetchGamePdf,
} from "../src/scraper";

// Unit tests — no network
describe("slugToTitle", () => {
  it("converts single-segment slug", () => {
    expect(slugToTitle("/jeu-de-plateau/catan")).toBe("Catan");
  });

  it("capitalises each hyphenated word", () => {
    expect(slugToTitle("/jeu-de-cartes/skull-king")).toBe("Skull King");
  });

  it("handles multi-word game names", () => {
    expect(slugToTitle("/jeu-de-plateau/terraforming-mars")).toBe("Terraforming Mars");
  });
});

describe("slugToId", () => {
  it("extracts last path segment", () => {
    expect(slugToId("/jeu-de-plateau/catan")).toBe("catan");
  });

  it("works for any category prefix", () => {
    expect(slugToId("/table-game/catan")).toBe("catan");
  });
});

// Integration tests — MSW active (configured in tests/setup.ts)
describe("buildIndex", () => {
  it("returns all 5 games from the fixture sitemap", async () => {
    const index = await buildIndex();
    expect(index.games.length).toBe(5);
  });

  it("each game has id, title, and slug", async () => {
    const index = await buildIndex();
    for (const game of index.games) {
      expect(game).toHaveProperty("id");
      expect(game).toHaveProperty("title");
      expect(game).toHaveProperty("slug");
      expect(game.id.length).toBeGreaterThan(0);
    }
  });

  it("does not fetch image sitemaps", async () => {
    // Fixture sitemap-index.xml has a sitemap_image loc.
    // If buildIndex fetches it, MSW throws (unhandledRequest: "error").
    // This test passing confirms image sitemaps are filtered.
    const index = await buildIndex();
    expect(index.games.length).toBeGreaterThan(0);
  });

  it("sets builtAt to a valid ISO timestamp", async () => {
    const index = await buildIndex();
    expect(() => new Date(index.builtAt)).not.toThrow();
    expect(new Date(index.builtAt).getTime()).toBeGreaterThan(0);
  });
});

describe("fetchGamePdf", () => {
  it("returns pdfUrl for English", async () => {
    const result = await fetchGamePdf("/jeu-de-plateau/catan", "en");
    expect(result.pdfUrl).toBe("https://cdn.1j1ju.com/medias/test-en.pdf");
  });

  it("returns pdfUrl for French", async () => {
    const result = await fetchGamePdf("/jeu-de-plateau/catan", "fr");
    expect(result.pdfUrl).toBe("https://cdn.1j1ju.com/medias/test-fr.pdf");
  });

  it("returns availableLanguages list containing en and fr", async () => {
    const result = await fetchGamePdf("/jeu-de-plateau/catan", "en");
    expect(result.availableLanguages).toContain("en");
    expect(result.availableLanguages).toContain("fr");
  });

  it("throws with available languages when requested language is missing", async () => {
    await expect(fetchGamePdf("/jeu-de-plateau/catan", "de")).rejects.toThrow(
      "Available: en, fr"
    );
  });
});

describe("buildIndex concurrency", () => {
  it("emits progress messages during index build", async () => {
    const messages: string[] = [];
    const index = await buildIndex((msg) => messages.push(msg));
    expect(messages.some((m) => m.includes("Fetching sitemap"))).toBe(true);
    expect(messages.some((m) => m.includes("games"))).toBe(true);
  });
});

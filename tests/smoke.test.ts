import { describe, it, expect, beforeAll } from "vitest";
import { http, passthrough } from "msw";
import { server } from "./handlers";
import { buildIndex } from "../src/scraper";
import { searchGames } from "../src/search";
import { fetchGamePdf } from "../src/scraper";

// Bypass MSW so smoke tests hit the real network
beforeAll(() => {
  server.use(http.all("*", () => passthrough()));
});

describe("smoke: live site", { timeout: 60_000 }, () => {
  it("buildIndex returns at least 1000 games", async () => {
    const index = await buildIndex();
    expect(index.games.length).toBeGreaterThanOrEqual(1000);
    expect(index.games[0]).toHaveProperty("id");
    expect(index.games[0]).toHaveProperty("title");
    expect(index.games[0]).toHaveProperty("slug");
  });

  it("searchGames finds catan in the live index", async () => {
    const index = await buildIndex();
    const results = searchGames(index.games, "catan");
    expect(results.length).toBeGreaterThan(0);
  });

  it("fetchGamePdf returns a CDN URL for a known game", async () => {
    const result = await fetchGamePdf("/jeu-de-plateau/catan", "en");
    expect(result.pdfUrl).toMatch(/^https:\/\/cdn\.1j1ju\.com\/.+\.pdf$/);
    expect(result.availableLanguages).toContain("en");
  });
});

import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("env-paths", () => ({
  default: () => ({
    config: path.join(os.tmpdir(), "boardgame-rules-mcp-test"),
  }),
}));

// Import AFTER the mock so module-level constants use the temp dir
import {
  isStale,
  pdfPath,
  textPath,
  loadIndex,
  saveIndex,
  summaryPath,
  isCacheFileStale,
  updateGameLanguages,
} from "../src/cache";
import type { GameIndex } from "../src/cache";

const TEST_CACHE_DIR = path.join(os.tmpdir(), "boardgame-rules-mcp-test");

beforeEach(async () => {
  await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

afterEach(async () => {
  await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

describe("isStale", () => {
  it("returns false when index is 29 days old", () => {
    const daysAgo = (n: number) =>
      new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
    const index: GameIndex = { builtAt: daysAgo(29), games: [] };
    expect(isStale(index)).toBe(false);
  });

  it("returns true when index is 31 days old", () => {
    const daysAgo = (n: number) =>
      new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
    const index: GameIndex = { builtAt: daysAgo(31), games: [] };
    expect(isStale(index)).toBe(true);
  });
});

describe("pdfPath", () => {
  it("returns expected path format", () => {
    const result = pdfPath("catan", "en");
    expect(result).toContain("pdfs");
    expect(result).toMatch(/catan_en\.pdf$/);
  });
});

describe("textPath", () => {
  it("returns expected path format", () => {
    const result = textPath("catan", "en");
    expect(result).toContain("text");
    expect(result).toMatch(/catan_en\.md$/);
  });
});

describe("loadIndex / saveIndex", () => {
  it("returns null when index file does not exist", async () => {
    const result = await loadIndex();
    expect(result).toBeNull();
  });

  it("round-trips: saveIndex then loadIndex returns the same data", async () => {
    const index: GameIndex = {
      builtAt: "2026-01-01T00:00:00.000Z",
      games: [{ id: "catan", title: "Catan", slug: "/jeu-de-plateau/catan" }],
    };
    await saveIndex(index);
    const loaded = await loadIndex();
    expect(loaded).toEqual(index);
  });
});

describe("summaryPath", () => {
  it("returns expected path format", () => {
    const result = summaryPath("catan", "en", "default");
    expect(result).toContain("summaries");
    expect(result).toMatch(/catan_en_default\.json$/);
  });
});

describe("isCacheFileStale", () => {
  it("returns false for a recently written file", async () => {
    const p = path.join(TEST_CACHE_DIR, "test.txt");
    await fs.mkdir(TEST_CACHE_DIR, { recursive: true });
    await fs.writeFile(p, "data");
    expect(await isCacheFileStale(p, 90)).toBe(false);
  });

  it("returns true for a non-existent file", async () => {
    const p = path.join(TEST_CACHE_DIR, "missing.txt");
    expect(await isCacheFileStale(p, 90)).toBe(true);
  });
});

describe("updateGameLanguages", () => {
  it("adds languages to the matching game entry", () => {
    const index: GameIndex = {
      builtAt: "2026-01-01T00:00:00.000Z",
      games: [{ id: "catan", title: "Catan", slug: "/catan" }],
    };
    const updated = updateGameLanguages(index, "catan", ["en", "fr"]);
    expect(updated.games[0].languages).toEqual(["en", "fr"]);
    expect(index.games[0].languages).toBeUndefined(); // original not mutated
  });

  it("returns index unchanged when game_id is not found", () => {
    const index: GameIndex = {
      builtAt: "2026-01-01T00:00:00.000Z",
      games: [{ id: "catan", title: "Catan", slug: "/catan" }],
    };
    const updated = updateGameLanguages(index, "unknown", ["en"]);
    expect(updated.games[0].languages).toBeUndefined();
  });
});

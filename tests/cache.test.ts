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

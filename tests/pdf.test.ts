import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./handlers";

const TEST_CACHE_DIR = path.join(os.tmpdir(), "boardgame-rules-mcp-pdf-test");

vi.mock("env-paths", () => {
  const os = require("os");
  const path = require("path");
  return {
    default: () => ({
      config: path.join(os.tmpdir(), "boardgame-rules-mcp-pdf-test"),
    }),
  };
});

const { mockPdfParse } = vi.hoisted(() => {
  const mockPdfParse = vi.fn().mockResolvedValue({
    text: "Catan rules: place settlements on intersections...",
  });
  return { mockPdfParse };
});
vi.mock("pdf-parse", () => ({ default: mockPdfParse }));

import { getRulebook } from "../src/pdf";

const PDF_URL = "https://cdn.1j1ju.com/medias/test-en.pdf";

beforeEach(async () => {
  await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
  mockPdfParse.mockClear();
});

afterEach(async () => {
  await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

describe("getRulebook", () => {
  it("downloads PDF and returns local_path and text", async () => {
    const result = await getRulebook(PDF_URL, "catan", "en");
    expect(result.local_path).toContain("catan_en.pdf");
    expect(result.text).toBe("Catan rules: place settlements on intersections...");
  });

  it("caches: second call does not re-download or re-extract", async () => {
    await getRulebook(PDF_URL, "catan", "en");
    mockPdfParse.mockClear();

    // Override MSW to throw if the CDN is hit again
    server.use(
      http.get("https://cdn.1j1ju.com/medias/:file", () => {
        throw new Error("PDF was fetched again — should be served from cache");
      })
    );

    const result = await getRulebook(PDF_URL, "catan", "en");
    expect(result.text).toBe("Catan rules: place settlements on intersections...");
    expect(mockPdfParse).not.toHaveBeenCalled();
  });

  it("throws with URL when PDF download fails", async () => {
    server.use(
      http.get("https://cdn.1j1ju.com/medias/:file", () =>
        new HttpResponse(null, { status: 503 })
      )
    );
    await expect(getRulebook(PDF_URL, "catan", "en")).rejects.toThrow(
      PDF_URL
    );
  });
});

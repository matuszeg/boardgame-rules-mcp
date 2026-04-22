import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("env-paths", () => ({
  default: () => ({
    config: path.join(os.tmpdir(), "boardgame-rules-mcp-summary-test"),
  }),
}));

import { getRulesSummaryResponse, submitRulesSummary } from "../src/summary.js";

const TEST_CACHE_DIR = path.join(os.tmpdir(), "boardgame-rules-mcp-summary-test");

beforeEach(async () => {
  await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
});
afterEach(async () => {
  await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

describe("submitRulesSummary", () => {
  it("validates and caches valid data", async () => {
    const data = {
      title: "Catan",
      players: { min: 3, max: 4 },
      objective: "Build settlements",
      turn_structure: ["Roll dice", "Trade", "Build"],
      winning_conditions: "First to 10 points wins",
    };
    const result = await submitRulesSummary("catan", "en", "default", data);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.path).toContain("catan_en_default.json");
  });

  it("returns validation errors for invalid data", async () => {
    const result = await submitRulesSummary("catan", "en", "default", {
      // missing required fields
      title: "Catan",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("getRulesSummaryResponse", () => {
  it("returns cached JSON when summary already exists", async () => {
    const data = {
      title: "Catan",
      players: { min: 3, max: 4 },
      objective: "Build settlements",
      turn_structure: ["Roll dice", "Trade", "Build"],
      winning_conditions: "First to 10 points wins",
    };
    await submitRulesSummary("catan", "en", "default", data);

    const res = await getRulesSummaryResponse("catan", "en", "default", async () => "ignored");
    expect(res.type).toBe("cached");
    if (res.type === "cached") expect(res.data).toMatchObject({ title: "Catan" });
  });

  it("returns prompt template when no cache exists", async () => {
    const res = await getRulesSummaryResponse(
      "catan",
      "en",
      "default",
      async () => "Full rulebook text here"
    );
    expect(res.type).toBe("prompt");
    if (res.type === "prompt") {
      expect(res.text).toContain("Full rulebook text here");
      expect(res.text).toContain("submit_rules_summary");
      expect(res.text).toContain("EXTRACTION SCHEMA");
      expect(res.text).toContain('"catan"');
      expect(res.text).toContain('"en"');
      expect(res.text).toContain('"default"');
    }
  });
});

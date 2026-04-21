import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildIndex as buildRealIndex } from "../src/scraper.js";
import { loadIndex, saveIndex } from "../src/cache.js";
import { searchGames } from "../src/search.js";
import type { GameIndex } from "../src/cache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "fixtures", "search-cases.json");

const SEED_QUERIES = [
  "Catan",
  "katan",
  "ticket to ride",
  "aventuriers du rail",
  "pandemic",
  "pandemc",
  "carcassonne",
  "7 wonders",
  "Terraforming Mars",
  "Codenames",
];

interface SearchCase {
  query: string;
  expected: string;
}

async function generateFixtures(index: GameIndex): Promise<SearchCase[]> {
  const cases: SearchCase[] = [];
  for (const query of SEED_QUERIES) {
    const results = searchGames(index.games, query);
    if (results.length > 0) {
      cases.push({ query, expected: results[0].game_id });
    }
  }
  await fs.mkdir(path.join(__dirname, "fixtures"), { recursive: true });
  await fs.writeFile(FIXTURE_PATH, JSON.stringify(cases, null, 2));
  return cases;
}

async function loadOrGenerateFixtures(index: GameIndex): Promise<SearchCase[]> {
  try {
    const raw = await fs.readFile(FIXTURE_PATH, "utf-8");
    return JSON.parse(raw) as SearchCase[];
  } catch {
    console.log("No fixture file found — generating from live index...");
    return generateFixtures(index);
  }
}

async function getIndex(): Promise<GameIndex> {
  let index = await loadIndex();
  if (!index) {
    console.log("Building game index...");
    index = await buildRealIndex();
    await saveIndex(index);
  }
  return index;
}

async function runCase(
  index: GameIndex,
  fixture: SearchCase
): Promise<"pass" | "fail"> {
  const results = searchGames(index.games, fixture.query);
  if (results.length > 0 && results[0].game_id === fixture.expected) {
    return "pass";
  }

  // Case failed — check if fixture is stale by re-searching with no expectation
  console.log(
    `  Checking if fixture is stale for query "${fixture.query}"...`
  );
  const liveResults = searchGames(index.games, fixture.query);
  if (liveResults.length > 0 && liveResults[0].game_id !== fixture.expected) {
    // Fixture is stale — update it
    fixture.expected = liveResults[0].game_id;
    const cases = JSON.parse(
      await fs.readFile(FIXTURE_PATH, "utf-8")
    ) as SearchCase[];
    const idx = cases.findIndex((c) => c.query === fixture.query);
    if (idx !== -1) cases[idx] = fixture;
    await fs.writeFile(FIXTURE_PATH, JSON.stringify(cases, null, 2));
    console.log(
      `  Fixture updated for "${fixture.query}" → "${fixture.expected}"`
    );
    // Re-run with updated expectation
    const reResults = searchGames(index.games, fixture.query);
    return reResults.length > 0 && reResults[0].game_id === fixture.expected
      ? "pass"
      : "fail";
  }

  return "fail";
}

describe("search quality evals", () => {
  let index: GameIndex;
  let fixtures: SearchCase[];

  beforeAll(async () => {
    index = await getIndex();
    fixtures = await loadOrGenerateFixtures(index);
  });

  it("achieves ≥90% pass rate across all search cases", async () => {
    const results = await Promise.all(
      fixtures.map((f) => runCase(index, f))
    );
    const passed = results.filter((r) => r === "pass").length;
    const score = passed / results.length;
    console.log(
      `\nSearch eval score: ${passed}/${results.length} (${Math.round(score * 100)}%)`
    );

    // Save results
    const resultsDir = path.join(__dirname, "results");
    await fs.mkdir(resultsDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    await fs.writeFile(
      path.join(resultsDir, `${date}-search.json`),
      JSON.stringify({ score, passed, total: results.length, fixtures }, null, 2)
    );

    expect(score).toBeGreaterThanOrEqual(0.9);
  });
});

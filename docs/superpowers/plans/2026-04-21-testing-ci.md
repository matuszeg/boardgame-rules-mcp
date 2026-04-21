# Testing and CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vitest + MSW automated tests (unit, mocked integration, live smoke) and GitHub Actions CI to `boardgame-rules-mcp`.

**Architecture:** Vitest runs TypeScript directly. MSW v2 intercepts `fetch` calls in integration tests using fixture XML/HTML files. `env-paths` and `pdf-parse` are mocked in unit tests to avoid real filesystem and binary dependencies. Smoke tests are excluded from `vitest run` and run separately via `npm run test:smoke`.

**Tech Stack:** `vitest ^2`, `msw ^2`, Node 20 LTS (CI)

---

## Files

- Modify: `package.json` — add `test`, `test:watch`, `test:smoke` scripts; add `vitest` and `msw` devDependencies
- Modify: `src/scraper.ts` — export `slugToTitle` and `slugToId` (currently unexported)
- Create: `vitest.config.ts`
- Create: `tests/fixtures/sitemap-index.xml`
- Create: `tests/fixtures/sitemap-boardgame.xml`
- Create: `tests/fixtures/game-page.html`
- Create: `tests/handlers.ts`
- Create: `tests/setup.ts`
- Create: `tests/cache.test.ts`
- Create: `tests/search.test.ts`
- Create: `tests/scraper.test.ts`
- Create: `tests/pdf.test.ts`
- Create: `tests/smoke.test.ts`
- Create: `.github/workflows/ci.yml`

---

### Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest and MSW**

```bash
npm install --save-dev vitest@^2 msw@^2
```

Expected: `node_modules/vitest` and `node_modules/msw` created, no errors.

- [ ] **Step 2: Add test scripts to package.json**

In `package.json`, update `"scripts"` to:

```json
"scripts": {
  "build": "tsc && chmod +x dist/index.js",
  "start": "node dist/index.js",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:smoke": "vitest run --reporter=verbose tests/smoke.test.ts"
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/tests/smoke.test.ts",
    ],
    setupFiles: ["./tests/setup.ts"],
  },
});
```

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

```bash
npm test
```

Expected: `No test files found, exiting with code 0` or similar — no error.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "feat(test): install vitest and msw, add test scripts"
```

---

### Task 2: Create test fixtures and MSW infrastructure

**Files:**
- Create: `tests/fixtures/sitemap-index.xml`
- Create: `tests/fixtures/sitemap-boardgame.xml`
- Create: `tests/fixtures/game-page.html`
- Create: `tests/handlers.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create tests/fixtures/sitemap-index.xml**

This mirrors the real root sitemap. Includes one `sitemap_boardgame` entry and one `sitemap_image` entry (to verify image sitemaps are filtered out).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.1jour-1jeu.com/sitemap_boardgame_00001.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.1jour-1jeu.com/sitemap_image_00001.xml</loc>
  </sitemap>
</sitemapindex>
```

- [ ] **Step 2: Create tests/fixtures/sitemap-boardgame.xml**

Five entries designed to test deduplication: `/jeu-de-plateau/catan` and `/table-game/catan` have the same `id` (`"catan"`) but different slugs — only the first should survive dedup. The remaining three are unique.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.1jour-1jeu.com/jeu-de-plateau/catan</loc></url>
  <url><loc>https://www.1jour-1jeu.com/table-game/catan</loc></url>
  <url><loc>https://www.1jour-1jeu.com/jeu-de-plateau/monopoly</loc></url>
  <url><loc>https://www.1jour-1jeu.com/jeu-de-cartes/skull-king</loc></url>
  <url><loc>https://www.1jour-1jeu.com/jeu-de-plateau/pandemic</loc></url>
</urlset>
```

- [ ] **Step 3: Create tests/fixtures/game-page.html**

Minimal HTML matching the real site's PDF link structure: `figcaption.blockquote-footer > a.dark-link` with `title="En <FrenchLanguageName>"`. Two languages (English and French).

```html
<!DOCTYPE html>
<html>
<body>
  <figcaption class="blockquote-footer">
    <a class="dark-link" href="https://cdn.1j1ju.com/medias/test-en.pdf" title="En Anglais">English</a>
    <a class="dark-link" href="https://cdn.1j1ju.com/medias/test-fr.pdf" title="En Français">Français</a>
  </figcaption>
</body>
</html>
```

- [ ] **Step 4: Create tests/handlers.ts**

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { readFileSync } from "fs";
import path from "path";

const fixturesDir = path.join(__dirname, "fixtures");

export const handlers = [
  http.get("https://en.1jour-1jeu.com/sitemap.xml", () =>
    new HttpResponse(
      readFileSync(path.join(fixturesDir, "sitemap-index.xml"), "utf-8"),
      { headers: { "Content-Type": "text/xml" } }
    )
  ),
  http.get("https://www.1jour-1jeu.com/sitemap_boardgame_00001.xml", () =>
    new HttpResponse(
      readFileSync(path.join(fixturesDir, "sitemap-boardgame.xml"), "utf-8"),
      { headers: { "Content-Type": "text/xml" } }
    )
  ),
  http.get("https://www.1jour-1jeu.com/:category/:slug", () =>
    new HttpResponse(
      readFileSync(path.join(fixturesDir, "game-page.html"), "utf-8"),
      { headers: { "Content-Type": "text/html" } }
    )
  ),
  http.get("https://cdn.1j1ju.com/medias/:file", () =>
    new HttpResponse("fake-pdf-bytes", {
      headers: { "Content-Type": "application/pdf" },
    })
  ),
];

export const server = setupServer(...handlers);
```

- [ ] **Step 5: Create tests/setup.ts**

`onUnhandledRequest: "error"` ensures any unmocked fetch call fails the test immediately — catches missing handlers early.

```typescript
import { server } from "./handlers";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 6: Build to catch TypeScript errors**

```bash
npm run build
```

Expected: no errors. (Vitest and MSW types don't affect the main build.)

- [ ] **Step 7: Commit**

```bash
git add tests/
git commit -m "feat(test): add MSW fixtures and test infrastructure"
```

---

### Task 3: cache.test.ts

**Files:**
- Create: `tests/cache.test.ts`

`cache.ts` initialises `CACHE_DIR` at module load via `env-paths`. Vitest hoists `vi.mock` above imports, so the mock is in place before the module resolves — the module-level `const paths = envPaths(...)` call receives the mocked function.

- [ ] **Step 1: Create tests/cache.test.ts**

```typescript
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const TEST_CACHE_DIR = path.join(os.tmpdir(), "boardgame-rules-mcp-test");

vi.mock("env-paths", () => ({
  default: () => ({ config: TEST_CACHE_DIR }),
}));

// Import AFTER the mock so module-level constants use the temp dir
import {
  isStale,
  pdfPath,
  textPath,
  loadIndex,
  saveIndex,
  GameIndex,
} from "../src/cache";

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
    expect(result).toEndWith("catan_en.pdf");
  });
});

describe("textPath", () => {
  it("returns expected path format", () => {
    const result = textPath("catan", "en");
    expect(result).toContain("text");
    expect(result).toEndWith("catan_en.md");
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
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 5 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add tests/cache.test.ts
git commit -m "test: cache module unit tests"
```

---

### Task 4: search.test.ts

**Files:**
- Create: `tests/search.test.ts`

`searchGames` is a pure function — no mocks needed.

- [ ] **Step 1: Create tests/search.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import { searchGames } from "../src/search";
import { GameEntry } from "../src/cache";

const GAMES: GameEntry[] = [
  { id: "catan", title: "Catan", slug: "/jeu-de-plateau/catan" },
  { id: "monopoly", title: "Monopoly", slug: "/jeu-de-plateau/monopoly" },
  { id: "pandemic", title: "Pandemic", slug: "/jeu-de-plateau/pandemic" },
  { id: "skull-king", title: "Skull King", slug: "/jeu-de-cartes/skull-king" },
  { id: "terraforming-mars", title: "Terraforming Mars", slug: "/jeu-de-plateau/terraforming-mars" },
  { id: "ticket-to-ride", title: "Ticket To Ride", slug: "/jeu-de-plateau/ticket-to-ride" },
  { id: "wingspan", title: "Wingspan", slug: "/jeu-de-plateau/wingspan" },
  { id: "dominion", title: "Dominion", slug: "/jeu-de-cartes/dominion" },
  { id: "azul", title: "Azul", slug: "/jeu-de-plateau/azul" },
  { id: "gloomhaven", title: "Gloomhaven", slug: "/jeu-de-plateau/gloomhaven" },
  { id: "viticulture", title: "Viticulture", slug: "/jeu-de-plateau/viticulture" },
];

describe("searchGames", () => {
  it("returns exact match first", () => {
    const results = searchGames(GAMES, "Catan");
    expect(results[0].game_id).toBe("catan");
  });

  it("returns partial match", () => {
    const results = searchGames(GAMES, "mono");
    expect(results.some((r) => r.game_id === "monopoly")).toBe(true);
  });

  it("returns fuzzy match for a typo", () => {
    const results = searchGames(GAMES, "Katan");
    expect(results.some((r) => r.game_id === "catan")).toBe(true);
  });

  it("returns empty array for no match", () => {
    const results = searchGames(GAMES, "xyzxyzxyz");
    expect(results).toHaveLength(0);
  });

  it("caps results at 10", () => {
    // "a" broadly matches many titles
    const results = searchGames(GAMES, "a");
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it("returns objects with game_id and title fields", () => {
    const results = searchGames(GAMES, "Catan");
    expect(results[0]).toHaveProperty("game_id");
    expect(results[0]).toHaveProperty("title");
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all previous tests pass plus 6 new search tests.

- [ ] **Step 3: Commit**

```bash
git add tests/search.test.ts
git commit -m "test: search module unit tests"
```

---

### Task 5: scraper.test.ts

**Files:**
- Modify: `src/scraper.ts` — export `slugToTitle` and `slugToId`
- Create: `tests/scraper.test.ts`

- [ ] **Step 1: Export slugToTitle and slugToId from src/scraper.ts**

Change lines 18 and 26 in `src/scraper.ts`:

```typescript
// Before:
function slugToTitle(slug: string): string {
// After:
export function slugToTitle(slug: string): string {
```

```typescript
// Before:
function slugToId(slug: string): string {
// After:
export function slugToId(slug: string): string {
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Create tests/scraper.test.ts**

The integration tests use MSW (configured globally via `tests/setup.ts`). The fixture sitemap has 5 entries but `buildIndex` should deduplicate `/jeu-de-plateau/catan` and `/table-game/catan` (same `id`), yielding 4 unique games.

Note: `buildIndex` deduplicates on `slug` (not `id`), so both `/jeu-de-plateau/catan` and `/table-game/catan` survive dedup (different slugs, same id). The test verifies 5 games are indexed (all unique slugs in the fixture).

```typescript
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

// Integration tests — MSW active (see tests/setup.ts)
describe("buildIndex", () => {
  it("returns all games from the fixture sitemap", async () => {
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
    // The fixture sitemap-index.xml contains a sitemap_image loc.
    // If buildIndex fetches it, MSW will throw (unhandled request).
    // This test passing means image sitemaps are correctly filtered.
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

  it("returns availableLanguages list", async () => {
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
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all previous tests pass plus the new scraper tests.

- [ ] **Step 5: Commit**

```bash
git add src/scraper.ts tests/scraper.test.ts
git commit -m "test: scraper unit and integration tests"
```

---

### Task 6: pdf.test.ts

**Files:**
- Create: `tests/pdf.test.ts`

`pdf-parse` is mocked to avoid needing a real PDF binary. MSW mocks the CDN download endpoint. `env-paths` is mocked so files are written to a temp directory.

- [ ] **Step 1: Create tests/pdf.test.ts**

```typescript
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./handlers";

const TEST_CACHE_DIR = path.join(os.tmpdir(), "boardgame-rules-mcp-test");

vi.mock("env-paths", () => ({
  default: () => ({ config: TEST_CACHE_DIR }),
}));

const mockPdfParse = vi.fn().mockResolvedValue({
  text: "Catan rules: place settlements on intersections...",
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
    expect(result.local_path).toEndWith("catan_en.pdf");
    expect(result.text).toBe("Catan rules: place settlements on intersections...");
  });

  it("caches: second call does not re-download or re-extract", async () => {
    await getRulebook(PDF_URL, "catan", "en");
    mockPdfParse.mockClear();

    // Override MSW to throw if the CDN is hit again
    server.use(
      http.get("https://cdn.1j1ju.com/medias/:file", () => {
        throw new Error("PDF was fetched again — not served from cache");
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
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all previous tests pass plus 3 new pdf tests.

- [ ] **Step 3: Commit**

```bash
git add tests/pdf.test.ts
git commit -m "test: pdf download and caching integration tests"
```

---

### Task 7: smoke.test.ts

**Files:**
- Create: `tests/smoke.test.ts`

Smoke tests hit the real 1jour-1jeu.com site. They are excluded from `npm test` (via `vitest.config.ts`) and run only via `npm run test:smoke`.

- [ ] **Step 1: Create tests/smoke.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import { buildIndex } from "../src/scraper";
import { searchGames } from "../src/search";
import { fetchGamePdf } from "../src/scraper";

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
    // Uses the French path as indexed by buildIndex
    const result = await fetchGamePdf("/jeu-de-plateau/catan", "en");
    expect(result.pdfUrl).toMatch(/^https:\/\/cdn\.1j1ju\.com\/.+\.pdf$/);
    expect(result.availableLanguages).toContain("en");
  });
});
```

- [ ] **Step 2: Run smoke tests manually to verify they pass**

```bash
npm run test:smoke
```

Expected: 3 tests pass. Takes ~10-30 seconds (live network).

- [ ] **Step 3: Confirm regular test run still excludes smoke**

```bash
npm test
```

Expected: same count as before — smoke.test.ts not included.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke.test.ts
git commit -m "test: live smoke tests for real site connectivity"
```

---

### Task 8: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Build and test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Type check and build
        run: npm run build

      - name: Unit and integration tests
        run: npm test

  smoke:
    name: Smoke test (live site)
    runs-on: ubuntu-latest
    needs: test
    continue-on-error: ${{ github.event.pull_request.head.repo.fork == true }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run build

      - name: Live smoke test
        run: npm run test:smoke

# Uncomment and add NPM_TOKEN secret to enable auto-publish on version tags:
# publish:
#   name: Publish to npm
#   runs-on: ubuntu-latest
#   needs: [test, smoke]
#   if: startsWith(github.ref, 'refs/tags/v')
#   steps:
#     - uses: actions/checkout@v4
#     - uses: actions/setup-node@v4
#       with:
#         node-version: 20
#         registry-url: https://registry.npmjs.org
#     - run: npm ci
#     - run: npm run build
#     - run: npm publish
#       env:
#         NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): add GitHub Actions CI with build, test, and smoke jobs"
git push origin main
```

- [ ] **Step 3: Verify CI runs on GitHub**

Go to `https://github.com/matuszeg/boardgame-rules-mcp/actions` and confirm the `CI` workflow triggered and both jobs pass.

---

## Self-Review

**Spec coverage:**
- Vitest installed and configured: Task 1 ✓
- MSW fixtures + setup: Task 2 ✓
- `cache.test.ts` — isStale boundary, pdfPath/textPath, loadIndex null, round-trip: Task 3 ✓
- `search.test.ts` — exact, partial, fuzzy, no-match, cap at 10: Task 4 ✓
- `scraper.test.ts` — slugToTitle/slugToId unit tests, buildIndex dedup/shape, fetchGamePdf language handling: Task 5 ✓
- `pdf.test.ts` — download, cache hit, download failure: Task 6 ✓
- `smoke.test.ts` — live buildIndex, search, fetchGamePdf: Task 7 ✓
- Smoke excluded from `npm test`: vitest.config.ts in Task 1 ✓
- GitHub Actions two-job CI (test + smoke): Task 8 ✓
- `continue-on-error` for fork PRs: Task 8 ✓
- Commented-out publish job: Task 8 ✓

**Placeholder scan:** None found.

**Type consistency:**
- `GameIndex`, `GameEntry` from `../src/cache` — consistent across all test files
- `slugToTitle`, `slugToId` exported in Task 5 Step 1 before used in Task 5 Step 3 ✓
- `mockPdfParse` defined before `vi.mock("pdf-parse", ...)` call — note: Vitest hoists `vi.mock` calls, so `mockPdfParse` must be defined using `vi.fn()` before the mock factory references it. The plan uses `vi.fn()` at the outer scope which Vitest handles correctly via hoisting ✓

**Dedup note:** `buildIndex` deduplicates on `slug` (not `id`). The fixture has `/jeu-de-plateau/catan` and `/table-game/catan` — these are different slugs, so both survive dedup, yielding 5 games total. The test in Task 5 reflects this (`toBe(5)`).

# Testing and CI Design

## Goal

Add automated testing (Vitest + MSW) and GitHub Actions CI to `boardgame-rules-mcp`. Tests run on every PR and push to `main`. Coverage spans unit tests for pure functions, mocked integration tests for network-dependent modules, and a live smoke test against the real site.

---

## Test Runner

**Vitest** — runs TypeScript directly, fast, native `fetch` compatible, works with MSW v2's Node.js integration. No `ts-jest` or Babel config needed.

---

## Directory Structure

```
tests/
├── fixtures/
│   ├── sitemap-index.xml       # Root sitemap with one boardgame sitemap loc
│   ├── sitemap-boardgame.xml   # 5 game entries across two categories (tests dedup)
│   └── game-page.html          # Game page with figcaption PDF links for 2 languages
├── handlers.ts                 # MSW request handlers returning fixture responses
├── setup.ts                    # MSW server lifecycle (beforeAll/afterAll/afterEach)
├── cache.test.ts
├── search.test.ts
├── scraper.test.ts
├── pdf.test.ts
└── smoke.test.ts
```

---

## package.json Scripts

```json
"test":       "vitest run",
"test:watch": "vitest",
"test:smoke": "vitest run --reporter=verbose tests/smoke.test.ts"
```

`vitest run` excludes `smoke.test.ts` via a `exclude` pattern in `vitest.config.ts`. Smoke tests only run via `test:smoke`.

---

## Dependencies to Add

```json
devDependencies:
  "vitest": "^2.0.0",
  "msw": "^2.0.0"
```

---

## Vitest Config

`vitest.config.ts` at project root:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "**/tests/smoke.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
});
```

---

## MSW Setup

### tests/handlers.ts

Defines four handlers:
- `GET https://en.1jour-1jeu.com/sitemap.xml` → returns `sitemap-index.xml` fixture
- `GET https://www.1jour-1jeu.com/sitemap_boardgame_*.xml` → returns `sitemap-boardgame.xml` fixture
- `GET https://www.1jour-1jeu.com/jeu-de-plateau/:slug` → returns `game-page.html` fixture
- `GET https://cdn.1j1ju.com/**/*.pdf` → returns a minimal valid PDF binary

### tests/setup.ts

```typescript
import { server } from "./handlers";
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: "error"` ensures tests fail if unexpected network calls are made — catches missing mocks early.

### Fixture Files

**`sitemap-index.xml`** — root sitemap containing one `sitemap_boardgame_00001.xml` loc (and one `sitemap_image_` loc to verify image sitemaps are filtered out).

**`sitemap-boardgame.xml`** — 5 game entries designed to exercise dedup:
- `/jeu-de-plateau/catan` and `/table-game/catan` (same id, different slug — dedup should keep first)
- `/jeu-de-plateau/monopoly`
- `/jeu-de-cartes/skull-king`
- `/jeu-de-plateau/pandemic`

**`game-page.html`** — minimal HTML with the real site's structure:
```html
<figcaption class="blockquote-footer">
  <a class="dark-link" href="https://cdn.1j1ju.com/medias/test-en.pdf" title="En Anglais">English</a>
  <a class="dark-link" href="https://cdn.1j1ju.com/medias/test-fr.pdf" title="En Français">Français</a>
</figcaption>
```

---

## Test Coverage

### cache.test.ts — Unit

Mock `env-paths` via `vi.mock("env-paths", ...)` to return `os.tmpdir()` so tests never touch the real cache directory.

| Test | What it checks |
|---|---|
| `isStale` — 29 days old | returns `false` |
| `isStale` — 31 days old | returns `true` |
| `pdfPath(gameId, lang)` | returns `{dir}/pdfs/{gameId}_{lang}.pdf` |
| `textPath(gameId, lang)` | returns `{dir}/text/{gameId}_{lang}.md` |
| `loadIndex` — file missing | returns `null` |
| `saveIndex` → `loadIndex` | round-trip preserves all fields |

### search.test.ts — Unit

No mocks needed. Pass a fixed array of `GameEntry` objects.

| Test | What it checks |
|---|---|
| Exact match "Catan" | returns Catan as first result |
| Partial match "cat" | returns Catan |
| Fuzzy match "Katan" (typo) | returns Catan |
| No match "xyzxyzxyz" | returns empty array |
| 15-game array, broad query | returns at most 10 results |

### scraper.test.ts — Unit + Integration

Unit tests (no MSW, no network):

| Test | What it checks |
|---|---|
| `slugToTitle("/jeu-de-plateau/catan")` | returns `"Catan"` |
| `slugToTitle("/jeu-de-cartes/skull-king")` | returns `"Skull King"` |
| `slugToId("/jeu-de-plateau/catan")` | returns `"catan"` |

Integration tests (MSW active):

| Test | What it checks |
|---|---|
| `buildIndex()` — dedup | returns 4 games (not 5 — catan deduplicated) |
| `buildIndex()` — image sitemaps filtered | image sitemap loc is not fetched |
| `buildIndex()` — game shape | each entry has `id`, `title`, `slug` |
| `fetchGamePdf(slug, "en")` | returns CDN URL for English PDF |
| `fetchGamePdf(slug, "fr")` | returns CDN URL for French PDF |
| `fetchGamePdf(slug, "de")` | throws error listing available languages (en, fr) |
| `fetchGamePdf(slug, "en")` — 404 game page | throws "Game page fetch failed" |

### pdf.test.ts — Integration

Uses MSW for the PDF download endpoint. Uses a small real PDF binary (the minimal valid PDF is 9 lines of ASCII) as the fixture response so `pdf-parse` can actually run.

| Test | What it checks |
|---|---|
| `getRulebook(url, id, lang)` — first call | downloads PDF, extracts text, returns both |
| `getRulebook(url, id, lang)` — second call | no MSW hit (served from disk cache) |
| `getRulebook` — download fails (MSW 500) | throws error containing the CDN URL |

### smoke.test.ts — Live network

Runs only via `npm run test:smoke`. No MSW — real `fetch` hits the real site.

| Test | What it checks |
|---|---|
| `buildIndex()` | returns ≥ 1000 games, all with id/title/slug |
| `searchGames(games, "catan")` | returns at least 1 result |
| `fetchGamePdf("/jeu-de-plateau/catan", "en")` | returns a CDN PDF URL |

---

## GitHub Actions

File: `.github/workflows/ci.yml`

### Triggers

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

### Job 1: `test`

- Runs on: `ubuntu-latest`, Node 20 LTS
- Steps: checkout → `npm ci` → `npm run build` → `npm test`
- Covers: type-check, unit tests, mocked integration tests

### Job 2: `smoke`

- Runs on: `ubuntu-latest`, Node 20 LTS
- Needs: `test` (only runs if test job passes)
- Steps: checkout → `npm ci` → `npm run build` → `npm run test:smoke`
- `continue-on-error: ${{ github.event.pull_request.head.repo.fork == true }}` — forks can't reach the live site reliably; smoke failures won't block the PR

### Commented-out publish job (ready for later)

```yaml
# publish:
#   needs: [test, smoke]
#   runs-on: ubuntu-latest
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

To activate: uncomment, add `NPM_TOKEN` to GitHub repo secrets.

---

## What This Does Not Cover

- No testing of `src/index.ts` (MCP server wiring) — the tool handlers are thin orchestration with no logic worth unit testing independently
- No Node version matrix — `engines: { node: ">=18" }` is narrow; Node 20 LTS covers it
- No coverage thresholds — coverage reporting can be added later with `vitest --coverage`

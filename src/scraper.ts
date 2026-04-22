import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { fetchWithRetry } from "./fetch.js";
import { GameEntry, GameIndex } from "./cache.js";

const BASE_URL = "https://en.1jour-1jeu.com";
const GAME_PAGE_BASE_URL = "https://www.1jour-1jeu.com";

// Map French language names (used in title attributes on the site) to ISO 639-1 codes
const FRENCH_LANG_NAME_TO_CODE: Record<string, string> = {
  Français: "fr",
  Anglais: "en",
  Allemand: "de",
  Espagnol: "es",
  Italien: "it",
  Néerlandais: "nl",
  Portugais: "pt",
};

export function slugToTitle(slug: string): string {
  const name = slug.split("/").pop() ?? slug;
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function slugToId(slug: string): string {
  return slug.split("/").pop() ?? slug;
}

async function fetchBoardgameSitemapUrls(): Promise<string[]> {
  const res = await fetchWithRetry(`${BASE_URL}/sitemap.xml`);
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls: string[] = [];
  $("loc").each((_, el) => {
    const loc = $(el).text().trim();
    if (
      loc.includes("sitemap_boardgame") &&
      !loc.includes("_image_") &&
      !loc.includes("_video_")
    )
      urls.push(loc);
  });
  return urls;
}

async function fetchGamesFromSitemap(url: string): Promise<GameEntry[]> {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const games: GameEntry[] = [];
  $("url loc").each((_, el) => {
    const loc = $(el).text().trim();
    const parsed = new URL(loc);
    const slug = parsed.pathname;
    // Skip non-game paths (e.g. schema definitions)
    if (slug.startsWith("/schemas/")) return;
    games.push({ id: slugToId(slug), title: slugToTitle(slug), slug });
  });
  return games;
}

export interface GamePdfResult {
  pdfUrl: string;
  availableLanguages: string[];
}

export async function fetchGamePdf(
  slug: string,
  language: string
): Promise<GamePdfResult> {
  const url = `${GAME_PAGE_BASE_URL}${slug}`;
  const res = await fetchWithRetry(url);
  if (!res.ok)
    throw new Error(`Game page fetch failed: ${res.status} — ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const pdfsByLang: Record<string, string> = {};
  // PDF links are <a class="dark-link"> inside <figcaption> elements. Title attribute is "En <FrenchLanguageName>".
  $("figcaption a.dark-link").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href.endsWith(".pdf")) return;
    const title = $(el).attr("title") ?? "";
    const frenchName = title.startsWith("En ") ? title.slice(3) : "";
    const langCode = FRENCH_LANG_NAME_TO_CODE[frenchName];
    if (langCode && !pdfsByLang[langCode]) pdfsByLang[langCode] = href;
  });

  const availableLanguages = Object.keys(pdfsByLang);
  if (availableLanguages.length === 0)
    throw new Error(`No PDF links found on page: ${url}`);

  const pdfUrl = pdfsByLang[language];
  if (!pdfUrl)
    throw new Error(
      `Language "${language}" not available. Available: ${availableLanguages.join(", ")}`
    );

  return { pdfUrl, availableLanguages };
}

export async function buildIndex(
  onProgress?: (msg: string) => void
): Promise<GameIndex> {
  onProgress?.("Fetching sitemap index...");
  const sitemapUrls = await fetchBoardgameSitemapUrls();
  if (sitemapUrls.length === 0)
    throw new Error("No boardgame sitemaps found in sitemap index");

  const limit = pLimit(5);
  let completed = 0;

  const results = await Promise.all(
    sitemapUrls.map((url) =>
      limit(async () => {
        const games = await fetchGamesFromSitemap(url);
        completed++;
        onProgress?.(`Fetched sub-sitemap ${completed} of ${sitemapUrls.length}`);
        return games;
      })
    )
  );
  const allGames = results.flat();

  const seen = new Set<string>();
  const uniqueGames = allGames.filter((g) => {
    if (seen.has(g.slug)) return false;
    seen.add(g.slug);
    return true;
  });

  onProgress?.(`Index built: ${uniqueGames.length} games`);

  return { builtAt: new Date().toISOString(), games: uniqueGames };
}

import * as cheerio from "cheerio";
import { GameEntry, GameIndex } from "./cache.js";

const BASE_URL = "https://en.1jour-1jeu.com";

function slugToTitle(slug: string): string {
  const name = slug.split("/").pop() ?? slug;
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function slugToId(slug: string): string {
  return slug.split("/").pop() ?? slug;
}

async function fetchBoardgameSitemapUrls(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/sitemap.xml`);
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
  const res = await fetch(url);
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
    games.push({
      id: slugToId(slug),
      title: slugToTitle(slug),
      slug,
    });
  });
  return games;
}

export async function buildIndex(): Promise<GameIndex> {
  const sitemapUrls = await fetchBoardgameSitemapUrls();
  if (sitemapUrls.length === 0) {
    throw new Error("No boardgame sitemaps found in sitemap index");
  }

  const allGames: GameEntry[] = [];
  for (const url of sitemapUrls) {
    const games = await fetchGamesFromSitemap(url);
    allGames.push(...games);
  }

  const seen = new Set<string>();
  const uniqueGames = allGames.filter((g) => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });

  return {
    builtAt: new Date().toISOString(),
    games: uniqueGames,
  };
}

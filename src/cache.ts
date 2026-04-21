import { promises as fs } from "fs";
import path from "path";
import envPaths from "env-paths";

const paths = envPaths("boardgame-rules-mcp", { suffix: "" });

export const CACHE_DIR = paths.config;
const INDEX_PATH = path.join(CACHE_DIR, "index.json");
const PDFS_DIR = path.join(CACHE_DIR, "pdfs");
const TEXT_DIR = path.join(CACHE_DIR, "text");
const SUMMARIES_DIR = path.join(CACHE_DIR, "summaries");

const STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_CACHE_MAX_AGE_DAYS = 90;

export interface GameEntry {
  id: string;
  title: string;
  slug: string;
  languages?: string[];
}

export interface GameIndex {
  builtAt: string;
  games: GameEntry[];
}

export async function ensureDirs(): Promise<void> {
  await fs.mkdir(PDFS_DIR, { recursive: true });
  await fs.mkdir(TEXT_DIR, { recursive: true });
  await fs.mkdir(SUMMARIES_DIR, { recursive: true });
}

export async function loadIndex(): Promise<GameIndex | null> {
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf-8");
    return JSON.parse(raw) as GameIndex;
  } catch {
    return null;
  }
}

export async function saveIndex(index: GameIndex): Promise<void> {
  await ensureDirs();
  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2));
}

export function isStale(index: GameIndex): boolean {
  return Date.now() - new Date(index.builtAt).getTime() > STALE_MS;
}

export function pdfPath(gameId: string, language: string): string {
  return path.join(PDFS_DIR, `${gameId}_${language}.pdf`);
}

export function textPath(gameId: string, language: string): string {
  return path.join(TEXT_DIR, `${gameId}_${language}.md`);
}

export function summaryPath(gameId: string, language: string, schema: string): string {
  return path.join(SUMMARIES_DIR, `${gameId}_${language}_${schema}.json`);
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function isCacheFileStale(
  filePath: string,
  maxAgeDays: number = DEFAULT_CACHE_MAX_AGE_DAYS
): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
  } catch {
    return true; // file does not exist → treat as stale
  }
}

export function updateGameLanguages(
  index: GameIndex,
  gameId: string,
  languages: string[]
): GameIndex {
  return {
    ...index,
    games: index.games.map((g) =>
      g.id === gameId ? { ...g, languages } : g
    ),
  };
}

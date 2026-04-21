import { promises as fs } from "fs";
import pdfParse from "pdf-parse";
import { pdfPath, textPath, isCacheFileStale, ensureDirs } from "./cache.js";
import { fetchWithRetry } from "./fetch.js";

export interface RulebookResult {
  local_path: string;
  text: string;
}

const MAX_AGE_DAYS = parseInt(process.env["BOARDGAME_CACHE_MAX_AGE_DAYS"] ?? "90", 10);

async function downloadPdf(
  pdfUrl: string,
  gameId: string,
  language: string
): Promise<string> {
  await ensureDirs();
  const dest = pdfPath(gameId, language);
  const res = await fetchWithRetry(pdfUrl);
  if (!res.ok) throw new Error(`PDF download failed: ${res.status} — ${pdfUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buffer);
  return dest;
}

async function extractText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  const text = data.text.trim();
  if (!text)
    throw new Error(
      "PDF text extraction returned empty — this PDF may be image-only (scanned)"
    );
  return text;
}

export async function getRulebook(
  pdfUrl: string,
  gameId: string,
  language: string
): Promise<RulebookResult> {
  let localPdfPath = pdfPath(gameId, language);
  if (await isCacheFileStale(localPdfPath, MAX_AGE_DAYS)) {
    localPdfPath = await downloadPdf(pdfUrl, gameId, language);
  }

  const localTextPath = textPath(gameId, language);
  let text: string;
  if (!(await isCacheFileStale(localTextPath, MAX_AGE_DAYS))) {
    text = await fs.readFile(localTextPath, "utf-8");
  } else {
    text = await extractText(localPdfPath);
    await fs.writeFile(localTextPath, text);
  }

  return { local_path: localPdfPath, text };
}

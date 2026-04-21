import { promises as fs } from "fs";
import pdfParse from "pdf-parse";
import { pdfPath, textPath, exists, ensureDirs } from "./cache.js";

export interface RulebookResult {
  local_path: string;
  text: string;
}

async function downloadPdf(
  pdfUrl: string,
  gameId: string,
  language: string
): Promise<string> {
  await ensureDirs();
  const dest = pdfPath(gameId, language);
  const res = await fetch(pdfUrl);
  if (!res.ok) {
    throw new Error(`PDF download failed: ${res.status} — ${pdfUrl}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buffer);
  return dest;
}

async function extractText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  const text = data.text.trim();
  if (!text) {
    throw new Error(
      "PDF text extraction returned empty — this PDF may be image-only (scanned)"
    );
  }
  return text;
}

export async function getRulebook(
  pdfUrl: string,
  gameId: string,
  language: string
): Promise<RulebookResult> {
  // Get or download PDF
  let localPdfPath = pdfPath(gameId, language);
  if (!(await exists(localPdfPath))) {
    localPdfPath = await downloadPdf(pdfUrl, gameId, language);
  }

  // Get or extract text
  const localTextPath = textPath(gameId, language);
  let text: string;
  if (await exists(localTextPath)) {
    text = await fs.readFile(localTextPath, "utf-8");
  } else {
    text = await extractText(localPdfPath);
    await fs.writeFile(localTextPath, text);
  }

  return { local_path: localPdfPath, text };
}

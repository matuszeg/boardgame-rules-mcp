import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";
import { loadSchema } from "../src/schema.js";
import { summaryPath } from "../src/cache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ajv = new Ajv({ strict: false });

// Games to test extraction on — must already have summaries cached
// Run: npm run evals (search evals first) then use Claude to run get_rules_summary on these games
const EVAL_GAME_IDS = ["catan", "pandemic", "carcassonne"];

interface JudgeScore {
  scores: Record<string, number>;
  overall: number;
  notes: string;
}

async function runLlmJudge(
  title: string,
  summary: object
): Promise<JudgeScore | null> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return null;

  const { Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are evaluating the quality of a board game rules summary.
Game: ${title}
Summary: ${JSON.stringify(summary, null, 2)}

Score each present field 1-3:
1 = missing or clearly wrong
2 = plausible but incomplete
3 = accurate and complete

Return JSON only: { "scores": { "fieldName": number, ... }, "overall": number, "notes": "string" }`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  try {
    return JSON.parse(text) as JudgeScore;
  } catch {
    return null;
  }
}

describe("extraction quality evals", () => {
  let defaultSchema: object;

  beforeAll(async () => {
    defaultSchema = await loadSchema("default");
  });

  for (const gameId of EVAL_GAME_IDS) {
    describe(`game: ${gameId}`, () => {
      it("cached summary passes schema validation", async () => {
        const summaryFile = summaryPath(gameId, "en", "default");
        let data: object;
        try {
          const raw = await fs.readFile(summaryFile, "utf-8");
          data = JSON.parse(raw) as object;
        } catch {
          console.warn(
            `No cached summary for ${gameId} — run get_rules_summary first`
          );
          return; // skip rather than fail
        }

        const validate = ajv.compile(defaultSchema);
        const valid = validate(data);
        if (!valid) {
          console.error("Validation errors:", validate.errors);
        }
        expect(valid).toBe(true);
      });

      it("cached summary scores ≥2.0 overall from LLM judge (skipped if no API key)", async () => {
        const summaryFile = summaryPath(gameId, "en", "default");
        let data: Record<string, unknown>;
        try {
          const raw = await fs.readFile(summaryFile, "utf-8");
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          console.warn(`No cached summary for ${gameId} — skipping LLM judge`);
          return;
        }

        const title = typeof data["title"] === "string" ? data["title"] : gameId;
        const judgeResult = await runLlmJudge(title, data);

        if (!judgeResult) {
          console.log("No ANTHROPIC_API_KEY — skipping LLM judge phase");
          return;
        }

        // Save judge result
        const resultsDir = path.join(__dirname, "results");
        await fs.mkdir(resultsDir, { recursive: true });
        const date = new Date().toISOString().slice(0, 10);
        await fs.writeFile(
          path.join(resultsDir, `${date}-extraction-${gameId}.json`),
          JSON.stringify(judgeResult, null, 2)
        );

        console.log(`\nLLM judge for ${gameId}:`, judgeResult);
        expect(judgeResult.overall).toBeGreaterThanOrEqual(2);
      });
    });
  }
});

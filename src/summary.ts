import { promises as fs } from "fs";
import Ajv2020 from "ajv/dist/2020.js";
import { summaryPath, isCacheFileStale, ensureDirs } from "./cache.js";
import { loadSchema } from "./schema.js";

export type SummaryResponse =
  | { type: "cached"; data: object }
  | { type: "prompt"; text: string };

export type SubmitResult =
  | { valid: true; path: string }
  | { valid: false; errors: string[] };

export async function getRulesSummaryResponse(
  gameId: string,
  language: string,
  schema: string,
  getText: (gameId: string, language: string) => Promise<string>
): Promise<SummaryResponse> {
  const cachePath = summaryPath(gameId, language, schema);

  if (!(await isCacheFileStale(cachePath))) {
    const raw = await fs.readFile(cachePath, "utf-8");
    return { type: "cached", data: JSON.parse(raw) as object };
  }

  const [text, schemaDef] = await Promise.all([
    getText(gameId, language),
    loadSchema(schema),
  ]);

  const prompt = buildExtractionPrompt(gameId, language, schema, text, schemaDef);
  return { type: "prompt", text: prompt };
}

export async function submitRulesSummary(
  gameId: string,
  language: string,
  schema: string,
  data: unknown
): Promise<SubmitResult> {
  const schemaDef = await loadSchema(schema);
  const ajv = new Ajv2020({ strict: false });
  const validate = ajv.compile(schemaDef);
  const valid = validate(data);

  if (!valid) {
    const errors = (validate.errors ?? []).map(
      (e) => `${e.instancePath || "root"}: ${e.message}`
    );
    return { valid: false, errors };
  }

  await ensureDirs();
  const dest = summaryPath(gameId, language, schema);
  await fs.writeFile(dest, JSON.stringify(data, null, 2));
  return { valid: true, path: dest };
}

function buildExtractionPrompt(
  gameId: string,
  language: string,
  schema: string,
  text: string,
  schemaDef: object
): string {
  return `[RULEBOOK TEXT]
${text}

[EXTRACTION SCHEMA]
${JSON.stringify(schemaDef, null, 2)}

[INSTRUCTION]
Extract the rules from the rulebook text above into JSON that matches the schema above.
- Invent appropriate slug-style variable names for any identifiers (e.g. CEL expressions, piece types).
- Omit fields that cannot be determined from the rulebook text rather than guessing.
- When done, call the submit_rules_summary tool with:
  game_id: "${gameId}"
  language: "${language}"
  schema: "${schema}"
  data: <your extracted JSON>`;
}

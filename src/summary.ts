import { promises as fs } from "fs";
import Ajv2020Pkg from "ajv/dist/2020.js";
import { summaryPath, isCacheFileStale, ensureDirs } from "./cache.js";
import { loadSchema } from "./schema.js";

const MAX_AGE_DAYS = parseInt(process.env["BOARDGAME_CACHE_MAX_AGE_DAYS"] ?? "90", 10) || 90;

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
  getText: () => Promise<string>
): Promise<SummaryResponse> {
  const cachePath = summaryPath(gameId, language, schema);

  if (!(await isCacheFileStale(cachePath, MAX_AGE_DAYS))) {
    const raw = await fs.readFile(cachePath, "utf-8");
    return { type: "cached", data: JSON.parse(raw) as object };
  }

  const [text, schemaDef] = await Promise.all([
    getText(),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ajv = new (Ajv2020Pkg as any)({ strict: false });
  const validate = ajv.compile(schemaDef);
  const valid = validate(data);

  if (!valid) {
    const errors = (validate.errors ?? []).map(
      (e: { instancePath?: string; message?: string }) =>
        `${e.instancePath || "root"}: ${e.message ?? "invalid"}`
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
  return `[INSTRUCTION — READ THIS FIRST]
Your ONLY next action is to extract rules from the rulebook below and call submit_rules_summary. Do not call any other tool. Do not search again. Do not ask for clarification.

Extract the rulebook text into JSON matching the schema, then immediately call:
  submit_rules_summary(
    game_id: "${gameId}",
    language: "${language}",
    schema: "${schema}",
    data: <your extracted JSON>
  )

Rules:
- Omit fields that cannot be determined from the text — do not guess.
- Invent slug-style names for any identifiers required by the schema.

[EXTRACTION SCHEMA]
${JSON.stringify(schemaDef, null, 2)}

[RULEBOOK TEXT]
${text}`;
}

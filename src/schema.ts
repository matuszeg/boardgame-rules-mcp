import { promises as fs } from "fs";
import path from "path";
import $RefParser from "@apidevtools/json-schema-ref-parser";

const DEFAULT_SCHEMA = {
  title: "Board Game Rules Summary",
  type: "object",
  required: ["title", "players", "objective", "turn_structure", "winning_conditions"],
  properties: {
    title: { type: "string" },
    players: {
      type: "object",
      properties: {
        min: { type: "integer", minimum: 1 },
        max: { type: "integer", minimum: 1 },
      },
    },
    duration_minutes: {
      type: "object",
      properties: {
        min: { type: "integer", minimum: 0 },
        max: { type: "integer", minimum: 0 },
      },
    },
    complexity: { enum: ["low", "medium", "high"] },
    objective: { type: "string" },
    setup: { type: "string" },
    turn_structure: { type: "array", items: { type: "string" } },
    winning_conditions: { type: "string" },
    key_mechanics: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
};

function getSchemaDirs(): string[] {
  const env = process.env["BOARDGAME_SCHEMA_DIRS"] ?? "";
  return env
    .split(":")
    .map((d) => d.trim())
    .filter(Boolean);
}

async function findSchemaFile(name: string): Promise<string | null> {
  for (const dir of getSchemaDirs()) {
    const candidate = path.join(dir, `${name}.schema.json`);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // not in this dir
    }
  }
  return null;
}

export async function loadSchema(name: string): Promise<object> {
  if (name === "default") return DEFAULT_SCHEMA;
  const filePath = await findSchemaFile(name);
  if (!filePath) throw new Error(`Schema not found: "${name}"`);
  // Resolve $ref cross-file references relative to the schema file
  return (await $RefParser.dereference(filePath)) as object;
}

export async function listAvailableSchemas(): Promise<string[]> {
  const names = new Set<string>(["default"]);
  for (const dir of getSchemaDirs()) {
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        if (entry.endsWith(".schema.json")) {
          names.add(entry.replace(/\.schema\.json$/, ""));
        }
      }
    } catch {
      // dir not accessible — skip
    }
  }
  return [...names];
}

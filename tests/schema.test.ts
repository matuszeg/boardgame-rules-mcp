import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadSchema, listAvailableSchemas } from "../src/schema.js";

const SCHEMA_DIR = path.join(os.tmpdir(), "boardgame-schema-test");

const CUSTOM_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Custom",
  type: "object",
  properties: { name: { type: "string" } },
};

beforeEach(async () => {
  await fs.mkdir(SCHEMA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(SCHEMA_DIR, "custom.schema.json"),
    JSON.stringify(CUSTOM_SCHEMA)
  );
  process.env["BOARDGAME_SCHEMA_DIRS"] = SCHEMA_DIR;
});

afterEach(async () => {
  await fs.rm(SCHEMA_DIR, { recursive: true, force: true });
  delete process.env["BOARDGAME_SCHEMA_DIRS"];
});

describe("loadSchema", () => {
  it("loads the built-in default schema", async () => {
    const schema = await loadSchema("default");
    expect(schema).toHaveProperty("title");
    expect(schema).toHaveProperty("properties");
  });

  it("loads a custom schema from BOARDGAME_SCHEMA_DIRS", async () => {
    const schema = await loadSchema("custom");
    expect(schema).toMatchObject({ title: "Custom" });
  });

  it("throws for an unknown schema name", async () => {
    await expect(loadSchema("nonexistent")).rejects.toThrow("Schema not found");
  });
});

describe("listAvailableSchemas", () => {
  it("includes default and custom schemas", async () => {
    const names = await listAvailableSchemas();
    expect(names).toContain("default");
    expect(names).toContain("custom");
  });
});

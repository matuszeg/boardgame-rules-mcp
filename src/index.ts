#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  loadIndex,
  saveIndex,
  isStale,
  updateGameLanguages,
} from "./cache.js";
import { buildIndex, fetchGamePdf } from "./scraper.js";
import { searchGames } from "./search.js";
import { getRulebook } from "./pdf.js";
import { getRulesSummaryResponse, submitRulesSummary } from "./summary.js";

const server = new Server(
  { name: "boardgame-rules-mcp", version: "0.1.0" },
  { capabilities: { tools: {}, logging: {} } }
);

function log(msg: string): void {
  void server.sendLoggingMessage({ level: "info", data: msg });
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_rulebook",
      description:
        "Search for a board game rulebook by name. Returns up to 10 matches. Use game_id from results with get_rulebook.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Game name to search for (partial match supported)",
          },
          language: {
            type: "string",
            description: 'Language code (default: "en"). E.g. "en", "fr", "de"',
            default: "en",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_rulebook",
      description:
        "Download and return a board game rulebook as text. Also returns the local PDF path.",
      inputSchema: {
        type: "object",
        properties: {
          game_id: {
            type: "string",
            description: "Game ID from search_rulebook results",
          },
          language: {
            type: "string",
            description: 'Language code (default: "en")',
            default: "en",
          },
        },
        required: ["game_id"],
      },
    },
    {
      name: "refresh_index",
      description:
        "Re-crawl the 1jour-1jeu.com sitemap and rebuild the local game index. Run this if a game is missing from search results.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_rules_summary",
      description:
        "Extract structured rules from a game's rulebook using the active schema. Returns cached JSON if available, otherwise returns the rulebook text and schema with instructions to call submit_rules_summary.",
      inputSchema: {
        type: "object",
        properties: {
          game_id: {
            type: "string",
            description: "Game ID from search_rulebook results",
          },
          language: {
            type: "string",
            description: 'Language code (default: "en")',
            default: "en",
          },
          schema: {
            type: "string",
            description: 'Schema name to use (default: "default")',
            default: "default",
          },
        },
        required: ["game_id"],
      },
    },
    {
      name: "submit_rules_summary",
      description:
        "Submit extracted rules JSON for validation and caching. Call this after get_rules_summary provides the extraction prompt.",
      inputSchema: {
        type: "object",
        properties: {
          game_id: { type: "string" },
          language: { type: "string", default: "en" },
          schema: { type: "string", default: "default" },
          data: { type: "object", description: "Extracted rules JSON matching the schema" },
        },
        required: ["game_id", "data"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;
  const str = (key: string, fallback = "") =>
    typeof a[key] === "string" ? (a[key] as string) : fallback;

  if (name === "refresh_index") {
    const start = Date.now();
    const index = await buildIndex(log);
    await saveIndex(index);
    const seconds = Math.round((Date.now() - start) / 1000);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            games_indexed: index.games.length,
            duration_seconds: seconds,
          }),
        },
      ],
    };
  }

  if (name === "search_rulebook") {
    const query = str("query");
    const language = str("language", "en");
    if (!query) throw new Error("query is required");

    let index = await loadIndex();
    let staleWarning = "";

    if (!index) {
      log("Building game index for the first time — this takes a few seconds...");
      index = await buildIndex(log);
      await saveIndex(index);
    } else if (isStale(index)) {
      staleWarning = "Index is older than 30 days. Run refresh_index to update it.";
    }

    const results = searchGames(index.games, query, language);

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No games found matching "${query}" in language "${language}". ${staleWarning}`.trim(),
          },
        ],
      };
    }

    const output: Record<string, unknown> = { results };
    if (staleWarning) output.warning = staleWarning;
    return { content: [{ type: "text", text: JSON.stringify(output) }] };
  }

  if (name === "get_rulebook") {
    const gameId = str("game_id");
    const language = str("language", "en");
    if (!gameId) throw new Error("game_id is required");

    let index = await loadIndex();
    if (!index) throw new Error("No game index found. Run search_rulebook first.");

    const game = index.games.find((g) => g.id === gameId);
    if (!game)
      throw new Error(
        `Game "${gameId}" not found in index. Run search_rulebook first, or refresh_index if the game is new.`
      );

    let pdfUrl: string;
    let availableLanguages: string[];
    try {
      const pdfResult = await fetchGamePdf(game.slug, language);
      pdfUrl = pdfResult.pdfUrl;
      availableLanguages = pdfResult.availableLanguages;
    } catch (err) {
      return {
        content: [{ type: "text", text: `Could not get PDF: ${(err as Error).message}` }],
      };
    }

    // Persist discovered languages back to the index
    index = updateGameLanguages(index, gameId, availableLanguages);
    await saveIndex(index);

    const result = await getRulebook(pdfUrl, gameId, language);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ local_path: result.local_path, text: result.text }),
        },
      ],
    };
  }

  if (name === "get_rules_summary") {
    const gameId = str("game_id");
    const language = str("language", "en");
    const schema = str("schema", "default");
    if (!gameId) throw new Error("game_id is required");

    let index = await loadIndex();
    if (!index) throw new Error("No game index found. Run search_rulebook first.");

    const game = index.games.find((g) => g.id === gameId);
    if (!game)
      throw new Error(`Game "${gameId}" not found in index.`);

    const getText = async () => {
      const pdfResult = await fetchGamePdf(game.slug, language);
      index = updateGameLanguages(index!, gameId, pdfResult.availableLanguages);
      await saveIndex(index);
      const result = await getRulebook(pdfResult.pdfUrl, gameId, language);
      return result.text;
    };

    const response = await getRulesSummaryResponse(gameId, language, schema, getText);
    return {
      content: [
        {
          type: "text",
          text:
            response.type === "cached"
              ? JSON.stringify(response.data, null, 2)
              : response.text,
        },
      ],
    };
  }

  if (name === "submit_rules_summary") {
    const gameId = str("game_id");
    const language = str("language", "en");
    const schema = str("schema", "default");
    const data = a["data"];
    if (!gameId) throw new Error("game_id is required");
    if (!data) throw new Error("data is required");

    const result = await submitRulesSummary(gameId, language, schema, data);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadIndex, saveIndex, isStale } from "./cache.js";
import { buildIndex, fetchGamePdf } from "./scraper.js";
import { searchGames } from "./search.js";
import { getRulebook } from "./pdf.js";

const server = new Server(
  { name: "boardgame-rules-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

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
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, string>;

  if (name === "refresh_index") {
    const start = Date.now();
    const index = await buildIndex();
    await saveIndex(index);
    const seconds = Math.round((Date.now() - start) / 1000);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ games_indexed: index.games.length, duration_seconds: seconds }),
        },
      ],
    };
  }

  if (name === "search_rulebook") {
    const query = a["query"];
    const language = a["language"] ?? "en";
    if (!query) throw new Error("query is required");

    let index = await loadIndex();
    let staleWarning = "";

    if (!index) {
      const notice = "Building game index for the first time — this takes a few seconds...";
      index = await buildIndex();
      await saveIndex(index);
      staleWarning = notice;
    } else if (isStale(index)) {
      staleWarning = "Index is older than 30 days. Run refresh_index to update it.";
    }

    const results = searchGames(index.games, query);

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No games found matching "${query}". ${staleWarning}`.trim(),
          },
        ],
      };
    }

    const output: Record<string, unknown> = { results };
    if (staleWarning) output.warning = staleWarning;
    void language; // language reserved for future filtering

    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }

  if (name === "get_rulebook") {
    const gameId = a["game_id"];
    const language = a["language"] ?? "en";
    if (!gameId) throw new Error("game_id is required");

    const index = await loadIndex();
    if (!index) {
      throw new Error(
        `No game index found. Run search_rulebook first to build the index.`
      );
    }
    const game = index.games.find((g) => g.id === gameId);
    if (!game) {
      throw new Error(
        `Game "${gameId}" not found in index. Run search_rulebook first, or refresh_index if the game is new.`
      );
    }

    let pdfUrl: string;
    try {
      const pdfResult = await fetchGamePdf(game.slug, language);
      pdfUrl = pdfResult.pdfUrl;
    } catch (err) {
      return {
        content: [{ type: "text", text: `Could not get PDF: ${(err as Error).message}` }],
      };
    }
    const result = await getRulebook(pdfUrl, gameId, language);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            local_path: result.local_path,
            text: result.text,
          }),
        },
      ],
    };
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

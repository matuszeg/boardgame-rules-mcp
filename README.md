# boardgame-rules-mcp

MCP server that lets AI assistants search and read board game rulebooks from [1jour-1jeu.com](https://en.1jour-1jeu.com/rules) — a database of 12,000+ rulebooks in multiple languages.

## Tools

- **search_rulebook(query, language?)** — fuzzy search by game name, returns up to 10 matches
- **get_rulebook(game_id, language?)** — downloads and returns the rulebook as text + local PDF path
- **refresh_index()** — re-crawls the site to update the local game index

## Example Conversation

> **You:** How many players can play Catan, and how do you win?
>
> **Claude:** Let me look that up.
> *(calls `search_rulebook` with query "Catan")*
> *(calls `get_rulebook` with game_id "catan")*
>
> Catan supports **3–4 players** (5–6 with an expansion). You win by being the first player to reach **10 Victory Points**. Points come from settlements (1 VP each), cities (2 VP each), the Longest Road card (2 VP), the Largest Army card (2 VP), and certain development cards.

> **You:** What about extracting a structured summary I can reuse?
>
> **Claude:** *(calls `get_rules_summary` with game_id "catan")*
> *(receives extraction prompt, fills in the schema)*
> *(calls `submit_rules_summary` with structured JSON)*
>
> Done — I've cached a structured summary for Catan. Future calls to `get_rules_summary` will return the JSON instantly without re-reading the PDF.

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "boardgame-rules-mcp": {
      "command": "npx",
      "args": ["boardgame-rules-mcp"]
    }
  }
}
```

### Other MCP clients

```bash
npx boardgame-rules-mcp
```

## How it works

On first search, the server crawls the 1jour-1jeu.com sitemap and builds a local index of all games (takes a few seconds, runs once). Subsequent searches are instant. When you fetch a rulebook, the PDF is downloaded and cached locally. Extracted text is also cached so subsequent requests are fast.

Cache lives at:
- Mac/Linux: `~/.config/boardgame-rules-mcp/`
- Windows: `%APPDATA%\boardgame-rules-mcp\`

## Language codes

Use standard ISO 639-1 codes: `en`, `fr`, `de`, `es`, `it`, `nl`, `pt`. Not all games are available in all languages.

## Troubleshooting

**"PDF text extraction returned empty"**
The rulebook PDF is image-only (scanned pages). These cannot be extracted automatically. Try a different language if available — some editions are digitally typeset.

**Game not appearing in search results**
The index may be out of date. Ask Claude to run `refresh_index`, then search again. This re-crawls the source site and takes ~30 seconds.

**Wrong or outdated rulebook**
PDFs are cached for 90 days (configurable via `BOARDGAME_CACHE_MAX_AGE_DAYS`). Delete the cached file at the path shown in the `get_rulebook` result to force a fresh download.

**Cache location**
- macOS: `~/Library/Application Support/boardgame-rules-mcp/`
- Linux: `~/.config/boardgame-rules-mcp/`
- Windows: `%APPDATA%\boardgame-rules-mcp\`

## License

MIT

# boardgame-rules-mcp

MCP server that lets AI assistants search and read board game rulebooks from [1jour-1jeu.com](https://en.1jour-1jeu.com/rules) — a database of 12,000+ rulebooks in multiple languages.

## Tools

- **search_rulebook(query, language?)** — fuzzy search by game name, returns up to 10 matches
- **get_rulebook(game_id, language?)** — downloads and returns the rulebook as text + local PDF path
- **refresh_index()** — re-crawls the site to update the local game index

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

## License

MIT

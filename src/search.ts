import Fuse from "fuse.js";
import { GameEntry } from "./cache.js";

export interface SearchResult {
  game_id: string;
  title: string;
}

export function searchGames(
  games: GameEntry[],
  query: string,
  language?: string
): SearchResult[] {
  const fuse = new Fuse(games, {
    keys: ["title"],
    threshold: 0.4,
    minMatchCharLength: 2,
  });

  return fuse
    .search(query, { limit: 10 })
    .filter(({ item }) => {
      if (!language) return true;
      if (!item.languages) return true; // unknown — include optimistically
      return item.languages.includes(language);
    })
    .map(({ item }) => ({
      game_id: item.id,
      title: item.title,
    }));
}

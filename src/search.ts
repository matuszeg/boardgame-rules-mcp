import Fuse from "fuse.js";
import { GameEntry } from "./cache.js";

export interface SearchResult {
  game_id: string;
  title: string;
}

export function searchGames(
  games: GameEntry[],
  query: string
): SearchResult[] {
  const fuse = new Fuse(games, {
    keys: ["title"],
    threshold: 0.4,
    minMatchCharLength: 2,
  });

  return fuse
    .search(query, { limit: 10 })
    .map((result) => ({
      game_id: result.item.id,
      title: result.item.title,
    }));
}

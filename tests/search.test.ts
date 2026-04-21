import { describe, it, expect } from "vitest";
import { searchGames } from "../src/search";
import type { GameEntry } from "../src/cache";

const GAMES: GameEntry[] = [
  { id: "catan", title: "Catan", slug: "/jeu-de-plateau/catan" },
  { id: "monopoly", title: "Monopoly", slug: "/jeu-de-plateau/monopoly" },
  { id: "pandemic", title: "Pandemic", slug: "/jeu-de-plateau/pandemic" },
  { id: "skull-king", title: "Skull King", slug: "/jeu-de-cartes/skull-king" },
  { id: "terraforming-mars", title: "Terraforming Mars", slug: "/jeu-de-plateau/terraforming-mars" },
  { id: "ticket-to-ride", title: "Ticket To Ride", slug: "/jeu-de-plateau/ticket-to-ride" },
  { id: "wingspan", title: "Wingspan", slug: "/jeu-de-plateau/wingspan" },
  { id: "dominion", title: "Dominion", slug: "/jeu-de-cartes/dominion" },
  { id: "azul", title: "Azul", slug: "/jeu-de-plateau/azul" },
  { id: "gloomhaven", title: "Gloomhaven", slug: "/jeu-de-plateau/gloomhaven" },
  { id: "viticulture", title: "Viticulture", slug: "/jeu-de-plateau/viticulture" },
];

describe("searchGames", () => {
  it("returns exact match first", () => {
    const results = searchGames(GAMES, "Catan");
    expect(results[0].game_id).toBe("catan");
  });

  it("returns partial match", () => {
    const results = searchGames(GAMES, "mono");
    expect(results.some((r) => r.game_id === "monopoly")).toBe(true);
  });

  it("returns fuzzy match for a typo", () => {
    const results = searchGames(GAMES, "Katan");
    expect(results.some((r) => r.game_id === "catan")).toBe(true);
  });

  it("returns empty array for no match", () => {
    const results = searchGames(GAMES, "xyzxyzxyz");
    expect(results).toHaveLength(0);
  });

  it("caps results at 10", () => {
    const results = searchGames(GAMES, "a");
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it("returns objects with game_id and title fields", () => {
    const results = searchGames(GAMES, "Catan");
    expect(results[0]).toHaveProperty("game_id");
    expect(results[0]).toHaveProperty("title");
  });
});

describe("searchGames with language filter", () => {
  it("includes games with no language data when language specified", () => {
    const games: GameEntry[] = [
      { id: "catan", title: "Catan", slug: "/catan" }, // no languages field
    ];
    const results = searchGames(games, "Catan", "de");
    expect(results).toHaveLength(1);
  });

  it("excludes games that explicitly do not have the requested language", () => {
    const games: GameEntry[] = [
      { id: "catan", title: "Catan", slug: "/catan", languages: ["en", "fr"] },
    ];
    const results = searchGames(games, "Catan", "de");
    expect(results).toHaveLength(0);
  });

  it("includes games that have the requested language", () => {
    const games: GameEntry[] = [
      { id: "catan", title: "Catan", slug: "/catan", languages: ["en", "de"] },
    ];
    const results = searchGames(games, "Catan", "de");
    expect(results).toHaveLength(1);
  });
});

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { readFileSync } from "fs";
import path from "path";

const fixturesDir = path.join(__dirname, "fixtures");

export const handlers = [
  http.get("https://en.1jour-1jeu.com/sitemap.xml", () =>
    new HttpResponse(
      readFileSync(path.join(fixturesDir, "sitemap-index.xml"), "utf-8"),
      { headers: { "Content-Type": "text/xml" } }
    )
  ),
  http.get("https://www.1jour-1jeu.com/sitemap_boardgame_00001.xml", () =>
    new HttpResponse(
      readFileSync(path.join(fixturesDir, "sitemap-boardgame.xml"), "utf-8"),
      { headers: { "Content-Type": "text/xml" } }
    )
  ),
  http.get("https://www.1jour-1jeu.com/:category/:slug", () =>
    new HttpResponse(
      readFileSync(path.join(fixturesDir, "game-page.html"), "utf-8"),
      { headers: { "Content-Type": "text/html" } }
    )
  ),
  http.get("https://cdn.1j1ju.com/medias/:file", () =>
    new HttpResponse("fake-pdf-bytes", {
      headers: { "Content-Type": "application/pdf" },
    })
  ),
];

export const server = setupServer(...handlers);

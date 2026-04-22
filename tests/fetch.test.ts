import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWithRetry } from "../src/fetch.js";

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns response immediately on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    const res = await fetchWithRetry("https://example.com");
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 and succeeds on second attempt", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("error", { status: 503 }))
      .mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    const res = await fetchWithRetry("https://example.com", undefined, { delays: [0, 0] });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 404", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", mockFetch);
    const res = await fetchWithRetry("https://example.com", undefined, { delays: [0, 0] });
    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting all attempts on network error", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", mockFetch);
    await expect(
      fetchWithRetry("https://example.com", undefined, { delays: [0, 0] })
    ).rejects.toThrow("ECONNREFUSED");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("returns last response after exhausting all attempts on persistent 5xx", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));
    vi.stubGlobal("fetch", mockFetch);
    const res = await fetchWithRetry("https://example.com", undefined, { delays: [0, 0] });
    // After 3 attempts, returns the last response rather than throwing
    expect(res.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

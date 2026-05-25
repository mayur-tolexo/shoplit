import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE,
  followCreator,
  getCreatorProfile,
  getFollowingFeed,
  listCreators,
  unfollowCreator,
} from "./api-client";

// Captures the URL + RequestInit the api-client hands to fetch, and lets each
// test decide the response. Verifies the request *shape* (URL + method) for the
// new discover/follow functions — the spec's normative contract.
function mockFetch(response: { ok?: boolean; status?: number; body?: unknown }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.body ?? {},
      text: async () => JSON.stringify(response.body ?? {}),
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api-client request shapes", () => {
  it("listCreators → GET /api/public/creators", async () => {
    const calls = mockFetch({ body: [] });
    await listCreators();
    expect(calls[0].url).toBe(`${API_BASE}/api/public/creators`);
    // jsonFetch defaults to no explicit method (GET).
    expect(calls[0].init.method ?? "GET").toBe("GET");
  });

  it("listCreators forwards limit/offset as query params", async () => {
    const calls = mockFetch({ body: [] });
    await listCreators(undefined, { limit: 24, offset: 24 });
    expect(calls[0].url).toBe(`${API_BASE}/api/public/creators?limit=24&offset=24`);
  });

  it("listCreators encodes q (spaces/special chars) and combines with limit/offset", async () => {
    const calls = mockFetch({ body: [] });
    await listCreators({}, { q: "ann & co" });
    // URLSearchParams encodes space as + and & as %26.
    expect(calls[0].url).toBe(`${API_BASE}/api/public/creators?q=ann+%26+co`);

    const calls2 = mockFetch({ body: [] });
    await listCreators({}, { q: "priya", limit: 10, offset: 0 });
    expect(calls2[0].url).toBe(
      `${API_BASE}/api/public/creators?limit=10&offset=0&q=priya`,
    );
    expect(calls2[0].init.method ?? "GET").toBe("GET");
  });

  it("getCreatorProfile → GET /api/public/creators/{handle}", async () => {
    const calls = mockFetch({ body: { creator: {}, carts: [] } });
    await getCreatorProfile("priya.styles");
    expect(calls[0].url).toBe(`${API_BASE}/api/public/creators/priya.styles`);
    expect(calls[0].init.method ?? "GET").toBe("GET");
  });

  it("getCreatorProfile returns null on 404", async () => {
    mockFetch({ ok: false, status: 404, body: "not found" });
    const r = await getCreatorProfile("ghost");
    expect(r).toBeNull();
  });

  it("followCreator → POST /api/v1/creators/{handle}/follow", async () => {
    const calls = mockFetch({ body: { following: true, followerCount: 1 } });
    const r = await followCreator("priya.styles");
    expect(calls[0].url).toBe(`${API_BASE}/api/v1/creators/priya.styles/follow`);
    expect(calls[0].init.method).toBe("POST");
    expect(r).toEqual({ following: true, followerCount: 1 });
  });

  it("unfollowCreator → DELETE /api/v1/creators/{handle}/follow", async () => {
    const calls = mockFetch({ body: { following: false, followerCount: 0 } });
    const r = await unfollowCreator("priya.styles");
    expect(calls[0].url).toBe(`${API_BASE}/api/v1/creators/priya.styles/follow`);
    expect(calls[0].init.method).toBe("DELETE");
    expect(r).toEqual({ following: false, followerCount: 0 });
  });

  it("getFollowingFeed → GET /api/v1/following", async () => {
    const calls = mockFetch({ body: [] });
    await getFollowingFeed();
    expect(calls[0].url).toBe(`${API_BASE}/api/v1/following`);
    expect(calls[0].init.method ?? "GET").toBe("GET");
  });

  it("getFollowingFeed forwards limit/offset", async () => {
    const calls = mockFetch({ body: [] });
    await getFollowingFeed(undefined, { limit: 10, offset: 5 });
    expect(calls[0].url).toBe(`${API_BASE}/api/v1/following?limit=10&offset=5`);
  });
});

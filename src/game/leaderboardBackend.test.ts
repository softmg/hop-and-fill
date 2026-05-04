import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("leaderboardBackend", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_LEADERBOARD_BACKEND_URL", "https://api.example.test/games");
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, String(value));
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => {
        storage.clear();
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts scores to the configured backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ playerId: "player-123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { saveBackendLeaderboardScore } = await import("./leaderboardBackend");

    await saveBackendLeaderboardScore("crash_cubes_total_stars", {
      score: 12,
      extraData: '{"completedLevels":4}',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/games/leaderboards/crash_cubes_total_stars/scores",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          leaderboardName: "crash_cubes_total_stars",
          score: 12,
          extraData: '{"completedLevels":4}',
        }),
      }),
    );
    expect(localStorage.getItem("crash-cubes:leaderboard-player-id")).toBe("player-123");
  });

  it("loads and normalizes backend entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          playerId: "player-456",
          userRank: 1,
          entries: [
            {
              score: "7",
              extraData: '{"completedLevels":3}',
              player: {
                publicName: "Ada",
                uniqueID: "ada",
                avatarSrc: "https://example.com/ada.png",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { loadBackendLeaderboardSnapshot } = await import("./leaderboardBackend");
    const result = await loadBackendLeaderboardSnapshot("crash_cubes_total_stars", {
      includeUser: true,
      quantityAround: 3,
      quantityTop: 10,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/games/leaderboards/crash_cubes_total_stars/entries?includeUser=true&quantityAround=3&quantityTop=10",
      expect.objectContaining({
        credentials: "include",
        method: "GET",
      }),
    );
    expect(result.userRank).toBe(1);
    expect(result.entries[0]).toMatchObject({
      rank: 1,
      score: 7,
      extraData: '{"completedLevels":3}',
      player: {
        publicName: "Ada",
        uniqueID: "ada",
      },
    });
    expect(result.entries[0].player.getAvatarSrc?.("small")).toBe("https://example.com/ada.png");
    expect(localStorage.getItem("crash-cubes:leaderboard-player-id")).toBe("player-456");
  });

  it("sends the persisted backend player id on later requests", async () => {
    localStorage.setItem("crash-cubes:leaderboard-player-id", "player-789");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ userRank: 0, entries: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { loadBackendLeaderboardSnapshot } = await import("./leaderboardBackend");

    await loadBackendLeaderboardSnapshot("crash_cubes_total_stars");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Crash-Cubes-Player-Id": "player-789",
        }),
      }),
    );
  });
});

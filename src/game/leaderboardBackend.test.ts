import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("leaderboardBackend", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_LEADERBOARD_BACKEND_URL", "https://api.example.test/games");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts scores to the configured backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
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
  });

  it("loads and normalizes backend entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
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
  });
});

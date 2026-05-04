import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerProgress } from "./progress";

const mockYsdkSetLeaderboardScore = vi.fn().mockResolvedValue(undefined);
const mockYsdkGetLeaderboardEntries = vi.fn();
const mockHasLeaderboardBackend = vi.fn(() => false);
const mockSaveBackendLeaderboardScore = vi.fn().mockResolvedValue(undefined);
const mockLoadBackendLeaderboardSnapshot = vi.fn();

vi.mock("@/sdk/yandex", () => ({
  ysdkSetLeaderboardScore: mockYsdkSetLeaderboardScore,
  ysdkGetLeaderboardEntries: mockYsdkGetLeaderboardEntries,
}));

vi.mock("./leaderboardBackend", () => ({
  hasLeaderboardBackend: mockHasLeaderboardBackend,
  saveBackendLeaderboardScore: mockSaveBackendLeaderboardScore,
  loadBackendLeaderboardSnapshot: mockLoadBackendLeaderboardSnapshot,
}));

const createProgress = (overrides: Partial<PlayerProgress> = {}): PlayerProgress => ({
  version: 1,
  unlockedLevel: 1,
  completedLevels: [],
  bestStarsByLevel: {},
  bestTimeMsByLevel: {},
  hasStarted: true,
  tutorialComplete: true,
  audioMuted: false,
  ...overrides,
});

describe("leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasLeaderboardBackend.mockReturnValue(false);
  });

  it("uses total stars as the leaderboard score", async () => {
    const { calculateLeaderboardScore } = await import("./leaderboard");

    expect(
      calculateLeaderboardScore(
        createProgress({
          bestStarsByLevel: { 1: 3, 2: 2, 3: 1 },
        }),
      ),
    ).toBe(6);
  });

  it("skips saving while the player has no score", async () => {
    const { saveLeaderboardScore } = await import("./leaderboard");

    await expect(saveLeaderboardScore(createProgress(), 25)).resolves.toEqual({ status: "skipped", score: 0 });
    expect(mockYsdkSetLeaderboardScore).not.toHaveBeenCalled();
  });

  it("submits the score with compact progress metadata", async () => {
    const { DEFAULT_LEADERBOARD_NAME, saveLeaderboardScore } = await import("./leaderboard");

    await expect(
      saveLeaderboardScore(
        createProgress({
          completedLevels: [1, 2],
          bestStarsByLevel: { 1: 3, 2: 2 },
          bestTimeMsByLevel: { 1: 1200, 2: 1500 },
        }),
        25,
        { requestAuthorization: true },
      ),
    ).resolves.toEqual({ status: "saved", score: 5 });

    expect(mockYsdkSetLeaderboardScore).toHaveBeenCalledWith(
      DEFAULT_LEADERBOARD_NAME,
      5,
      expect.stringContaining('"completedLevels":2'),
      { requestAuthorization: true },
    );
  });

  it("submits the score to the configured backend instead of the Yandex SDK", async () => {
    mockHasLeaderboardBackend.mockReturnValue(true);
    const { DEFAULT_LEADERBOARD_NAME, saveLeaderboardScore } = await import("./leaderboard");

    await expect(
      saveLeaderboardScore(
        createProgress({
          completedLevels: [1, 2],
          bestStarsByLevel: { 1: 3, 2: 2 },
          bestTimeMsByLevel: { 1: 1200, 2: 1500 },
        }),
        25,
        { requestAuthorization: true },
      ),
    ).resolves.toEqual({ status: "saved", score: 5 });

    expect(mockSaveBackendLeaderboardScore).toHaveBeenCalledWith(
      DEFAULT_LEADERBOARD_NAME,
      {
        score: 5,
        extraData: expect.stringContaining('"completedLevels":2'),
      },
    );
    expect(mockYsdkSetLeaderboardScore).not.toHaveBeenCalled();
  });

  it("loads and normalizes leaderboard rows", async () => {
    mockYsdkGetLeaderboardEntries.mockResolvedValue({
      userRank: 2,
      entries: [
        {
          rank: 1,
          score: 10,
          extraData: '{"completedLevels":4,"levelCount":25,"totalBestTimeMs":3300}',
          player: {
            publicName: "Ada",
            uniqueID: "ada",
            getAvatarSrc: () => "https://example.com/ada.png",
          },
        },
        {
          rank: 2,
          score: 8,
          extraData: "",
          player: {
            publicName: "",
            uniqueID: "me",
          },
        },
      ],
    });

    const { loadLeaderboardSnapshot } = await import("./leaderboard");

    await expect(loadLeaderboardSnapshot()).resolves.toEqual({
      userRank: 2,
      entries: [
        {
          rank: 1,
          score: 10,
          publicName: "Ada",
          avatarSrc: "https://example.com/ada.png",
          uniqueID: "ada",
          completedLevels: 4,
          levelCount: 25,
          totalBestTimeMs: 3300,
          isCurrentUser: false,
        },
        {
          rank: 2,
          score: 8,
          publicName: "Игрок",
          avatarSrc: null,
          uniqueID: "me",
          completedLevels: null,
          levelCount: null,
          totalBestTimeMs: null,
          isCurrentUser: true,
        },
      ],
    });
  });

  it("loads and normalizes rows from the configured backend", async () => {
    mockHasLeaderboardBackend.mockReturnValue(true);
    mockLoadBackendLeaderboardSnapshot.mockResolvedValue({
      userRank: 1,
      entries: [
        {
          rank: 1,
          score: 7,
          extraData: '{"completedLevels":3,"levelCount":25,"totalBestTimeMs":2200}',
          player: {
            publicName: "Backend Player",
            uniqueID: "backend-player",
            getAvatarSrc: () => "https://example.com/backend.png",
          },
        },
      ],
    });

    const { loadLeaderboardSnapshot } = await import("./leaderboard");

    await expect(loadLeaderboardSnapshot()).resolves.toEqual({
      userRank: 1,
      entries: [
        {
          rank: 1,
          score: 7,
          publicName: "Backend Player",
          avatarSrc: "https://example.com/backend.png",
          uniqueID: "backend-player",
          completedLevels: 3,
          levelCount: 25,
          totalBestTimeMs: 2200,
          isCurrentUser: true,
        },
      ],
    });
    expect(mockYsdkGetLeaderboardEntries).not.toHaveBeenCalled();
  });
});

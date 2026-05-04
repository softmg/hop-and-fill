import { describe, expect, it } from "vitest";
import {
  SHARED_RESULT_QUERY_PARAM,
  buildSharedResultUrl,
  createSharedResult,
  decodeSharedResult,
  encodeSharedResult,
} from "./shareResult";
import type { PlayerProgress } from "./progress";

const progress: PlayerProgress = {
  version: 1,
  unlockedLevel: 4,
  completedLevels: [1, 2, 3],
  bestStarsByLevel: { 1: 3, 2: 2, 3: 1 },
  bestTimeMsByLevel: { 1: 4000, 2: 8000, 3: 9000 },
  hasStarted: true,
  tutorialComplete: true,
  audioMuted: false,
};

describe("shareResult", () => {
  it("encodes and decodes a level result snapshot", () => {
    const result = createSharedResult(progress, 25, {
      kind: "level",
      levelNumber: 3,
      levelName: "Bridge Sprint",
      stars: 2,
      hops: 14,
      optimalMoves: 12,
      timeMs: 1830,
    });

    const token = encodeSharedResult(result);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSharedResult(token)).toEqual({
      version: 1,
      kind: "level",
      completedLevels: 3,
      levelCount: 25,
      totalStars: 6,
      maxStars: 75,
      totalRaces: 2,
      maxRaces: 25,
      totalBestTimeMs: 21000,
      level: {
        number: 3,
        name: "Bridge Sprint",
        stars: 2,
        hops: 14,
        optimalMoves: 12,
        timeMs: 1830,
      },
    });
  });

  it("builds a root-safe share URL and rejects invalid tokens", () => {
    const result = createSharedResult(progress, 25, { kind: "final" });
    const shareUrl = buildSharedResultUrl(result, "https://example.com/game/?utm=old#pause");
    const url = new URL(shareUrl);
    const token = url.searchParams.get(SHARED_RESULT_QUERY_PARAM);

    expect(url.origin + url.pathname).toBe("https://example.com/game/");
    expect(url.searchParams.has("utm")).toBe(false);
    expect(url.hash).toBe("");
    expect(decodeSharedResult(token)?.kind).toBe("final");
    expect(decodeSharedResult("broken token")).toBeNull();
  });
});

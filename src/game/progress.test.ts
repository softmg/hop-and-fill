import { describe, expect, it } from "vitest";
import {
  completeLevel,
  completeTutorial,
  createDefaultProgress,
  getBestStars,
  getTotalStars,
  isLevelUnlocked,
  normalizeProgress,
} from "./progress";

describe("player progress", () => {
  it("starts with only the first level unlocked", () => {
    const progress = createDefaultProgress();

    expect(isLevelUnlocked(progress, 0)).toBe(true);
    expect(isLevelUnlocked(progress, 1)).toBe(false);
    expect(getTotalStars(progress)).toBe(0);
  });

  it("unlocks only the next level after a win", () => {
    const progress = completeLevel(createDefaultProgress(), 0, 2, 10);

    expect(progress.unlockedLevel).toBe(2);
    expect(progress.completedLevels).toEqual([1]);
    expect(getBestStars(progress, 0)).toBe(2);
    expect(isLevelUnlocked(progress, 1)).toBe(true);
    expect(isLevelUnlocked(progress, 2)).toBe(false);
  });

  it("keeps the best stars when replaying a completed level", () => {
    const threeStars = completeLevel(createDefaultProgress(), 0, 3, 10);
    const replayed = completeLevel(threeStars, 0, 1, 10);

    expect(replayed.completedLevels).toEqual([1]);
    expect(getBestStars(replayed, 0)).toBe(3);
    expect(getTotalStars(replayed)).toBe(3);
  });

  it("normalizes corrupt progress data", () => {
    const progress = normalizeProgress(
      {
        unlockedLevel: 99,
        completedLevels: [3, 2, 2, 100, "bad"],
        bestStarsByLevel: {
          1: 3,
          2: 4,
          3: 2,
          99: 1,
        },
      },
      5,
    );

    expect(progress.unlockedLevel).toBe(5);
    expect(progress.completedLevels).toEqual([2, 3]);
    expect(progress.bestStarsByLevel).toEqual({ 1: 3, 3: 2 });
  });

  it("stores tutorial completion in the shared progress object", () => {
    const progress = completeTutorial(createDefaultProgress(), 10);

    expect(progress.tutorialComplete).toBe(true);
  });
});

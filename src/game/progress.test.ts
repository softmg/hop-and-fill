import { describe, expect, it } from "vitest";
import {
  completeLevel,
  completeTutorial,
  createDefaultProgress,
  getBestStars,
  getMaxRaces,
  getRaceTimeLimitMs,
  getBestTimeMs,
  getTotalRaces,
  getTotalStars,
  hasRaceAward,
  isLevelUnlocked,
  markGameStarted,
  mergeProgress,
  normalizeProgress,
  setAudioMuted,
} from "./progress";

describe("player progress", () => {
  it("starts with only the first level unlocked", () => {
    const progress = createDefaultProgress();

    expect(isLevelUnlocked(progress, 0)).toBe(true);
    expect(isLevelUnlocked(progress, 1)).toBe(false);
    expect(getTotalStars(progress)).toBe(0);
    expect(getTotalRaces(progress, 10)).toBe(0);
    expect(getBestTimeMs(progress, 0)).toBe(null);
    expect(progress.hasStarted).toBe(false);
    expect(progress.audioMuted).toBe(false);
  });

  it("unlocks only the next level after a win", () => {
    const progress = completeLevel(createDefaultProgress(), 0, 2, 10);

    expect(progress.unlockedLevel).toBe(2);
    expect(progress.completedLevels).toEqual([1]);
    expect(getBestStars(progress, 0)).toBe(2);
    expect(getBestTimeMs(progress, 0)).toBe(null);
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

  it("stores the fastest completion time when replaying a completed level", () => {
    const firstRun = completeLevel(createDefaultProgress(), 0, 3, 10, 12_500);
    const slowerReplay = completeLevel(firstRun, 0, 3, 10, 15_000);
    const fasterReplay = completeLevel(slowerReplay, 0, 3, 10, 9_250);

    expect(getBestTimeMs(firstRun, 0)).toBe(12_500);
    expect(getBestTimeMs(slowerReplay, 0)).toBe(12_500);
    expect(getBestTimeMs(fasterReplay, 0)).toBe(9_250);
  });

  it("counts race awards from best times within the configured limits", () => {
    const progress = normalizeProgress(
      {
        unlockedLevel: 26,
        completedLevels: [1, 2, 3, 26],
        bestTimeMsByLevel: {
          1: 5_000,
          2: 6_001,
          3: 14_999,
          26: 1,
        },
      },
      30,
    );

    expect(getRaceTimeLimitMs(0)).toBe(5_000);
    expect(getRaceTimeLimitMs(24)).toBe(80_000);
    expect(getRaceTimeLimitMs(25)).toBe(null);
    expect(getMaxRaces(30)).toBe(25);
    expect(hasRaceAward(progress, 0)).toBe(true);
    expect(hasRaceAward(progress, 1)).toBe(false);
    expect(hasRaceAward(progress, 2)).toBe(true);
    expect(hasRaceAward(progress, 25)).toBe(false);
    expect(getTotalRaces(progress, 30)).toBe(2);
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
        bestTimeMsByLevel: {
          1: 10_000,
          2: -5,
          3: 12_345.9,
          99: 1_000,
        },
        audioMuted: "nope",
      },
      5,
    );

    expect(progress.unlockedLevel).toBe(5);
    expect(progress.completedLevels).toEqual([2, 3]);
    expect(progress.bestStarsByLevel).toEqual({ 1: 3, 3: 2 });
    expect(progress.bestTimeMsByLevel).toEqual({ 1: 10_000, 3: 12_345 });
    expect(progress.hasStarted).toBe(true);
    expect(progress.audioMuted).toBe(false);
  });

  it("merges local and cloud progress without losing the best result", () => {
    const progress = mergeProgress(
      {
        unlockedLevel: 3,
        completedLevels: [1, 2],
        bestStarsByLevel: { 1: 2, 2: 3 },
        bestTimeMsByLevel: { 1: 8_000, 2: 7_000 },
        hasStarted: true,
        tutorialComplete: false,
        audioMuted: true,
      },
      {
        unlockedLevel: 4,
        completedLevels: [1, 3],
        bestStarsByLevel: { 1: 3, 3: 1 },
        bestTimeMsByLevel: { 1: 9_000, 3: 14_000 },
        hasStarted: true,
        tutorialComplete: true,
        audioMuted: false,
      },
      5,
    );

    expect(progress.unlockedLevel).toBe(4);
    expect(progress.completedLevels).toEqual([1, 2, 3]);
    expect(progress.bestStarsByLevel).toEqual({ 1: 3, 2: 3, 3: 1 });
    expect(progress.bestTimeMsByLevel).toEqual({ 1: 8_000, 2: 7_000, 3: 14_000 });
    expect(progress.tutorialComplete).toBe(true);
    expect(progress.audioMuted).toBe(true);
  });

  it("keeps cloud preferences when there is no local progress yet", () => {
    const progress = mergeProgress(
      null,
      {
        unlockedLevel: 2,
        completedLevels: [1],
        hasStarted: true,
        tutorialComplete: true,
        audioMuted: true,
      },
      5,
    );

    expect(progress.unlockedLevel).toBe(2);
    expect(progress.audioMuted).toBe(true);
  });

  it("stores tutorial completion in the shared progress object", () => {
    const progress = completeTutorial(createDefaultProgress(), 10);

    expect(progress.hasStarted).toBe(true);
    expect(progress.tutorialComplete).toBe(true);
  });

  it("stores the first start separately from tutorial completion", () => {
    const progress = markGameStarted(createDefaultProgress(), 10);

    expect(progress.hasStarted).toBe(true);
    expect(progress.tutorialComplete).toBe(false);
  });

  it("stores the mute preference in player progress", () => {
    const progress = setAudioMuted(createDefaultProgress(), true, 10);

    expect(progress.audioMuted).toBe(true);
  });
});

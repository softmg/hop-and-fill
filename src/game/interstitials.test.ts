import { describe, expect, it } from "vitest";
import { decideInterstitialTrigger, INTERSTITIAL_COMPLETION_CADENCE } from "./interstitials";

describe("interstitial scheduling", () => {
  it("shows an interstitial after a loss", () => {
    expect(
      decideInterstitialTrigger({
        outcome: "loss",
        completedLevelsCount: INTERSTITIAL_COMPLETION_CADENCE,
        currentLevelIndex: 3,
        nextLevelIndex: 4,
        currentTheme: "slime",
        nextTheme: "neon",
      }),
    ).toBe("after-loss");
  });

  it("skips non-cadence wins inside the same chapter", () => {
    expect(
      decideInterstitialTrigger({
        outcome: "win",
        completedLevelsCount: 2,
        currentLevelIndex: 1,
        nextLevelIndex: 2,
        currentTheme: "default",
        nextTheme: "default",
      }),
    ).toBe("none");
  });

  it("shows a periodic win interstitial on the cadence", () => {
    expect(
      decideInterstitialTrigger({
        outcome: "win",
        completedLevelsCount: INTERSTITIAL_COMPLETION_CADENCE,
        didCompleteNewLevel: true,
        currentLevelIndex: 2,
        nextLevelIndex: 3,
        currentTheme: "slime",
        nextTheme: "slime",
      }),
    ).toBe("periodic-win");
  });

  it("shows a chapter-boundary interstitial before the next level starts", () => {
    expect(
      decideInterstitialTrigger({
        outcome: "win",
        completedLevelsCount: 1,
        currentLevelIndex: 3,
        nextLevelIndex: 4,
        currentTheme: "slime",
        nextTheme: "neon",
      }),
    ).toBe("chapter-boundary");
  });

  it("prefers chapter-boundary over periodic win when both apply", () => {
    expect(
      decideInterstitialTrigger({
        outcome: "win",
        completedLevelsCount: INTERSTITIAL_COMPLETION_CADENCE,
        didCompleteNewLevel: true,
        currentLevelIndex: 3,
        nextLevelIndex: 4,
        currentTheme: "slime",
        nextTheme: "neon",
      }),
    ).toBe("chapter-boundary");
  });

  it("skips periodic win interstitials for replayed wins", () => {
    expect(
      decideInterstitialTrigger({
        outcome: "win",
        completedLevelsCount: INTERSTITIAL_COMPLETION_CADENCE,
        didCompleteNewLevel: false,
        currentLevelIndex: 2,
        nextLevelIndex: 3,
        currentTheme: "slime",
        nextTheme: "slime",
      }),
    ).toBe("none");
  });

  it("still allows chapter-boundary interstitials on replayed wins", () => {
    expect(
      decideInterstitialTrigger({
        outcome: "win",
        completedLevelsCount: INTERSTITIAL_COMPLETION_CADENCE,
        didCompleteNewLevel: false,
        currentLevelIndex: 3,
        nextLevelIndex: 4,
        currentTheme: "slime",
        nextTheme: "neon",
      }),
    ).toBe("chapter-boundary");
  });

  it("does not schedule an ad without a completed transition", () => {
    expect(
      decideInterstitialTrigger({
        outcome: "none",
        completedLevelsCount: 0,
        currentLevelIndex: 0,
        nextLevelIndex: 1,
        currentTheme: "default",
        nextTheme: "default",
      }),
    ).toBe("none");
  });
});

import type { LevelData } from "./Level";

export const INTERSTITIAL_COMPLETION_CADENCE = 3;

export type InterstitialTrigger = "none" | "after-loss" | "periodic-win" | "chapter-boundary";

interface DecideInterstitialInput {
  outcome: "none" | "win" | "loss";
  completedLevelsCount: number;
  didCompleteNewLevel?: boolean;
  currentLevelIndex: number;
  nextLevelIndex: number | null;
  currentTheme?: LevelData["theme"];
  nextTheme?: LevelData["theme"];
  cadence?: number;
}

export function decideInterstitialTrigger({
  outcome,
  completedLevelsCount,
  didCompleteNewLevel = true,
  currentLevelIndex,
  nextLevelIndex,
  currentTheme,
  nextTheme,
  cadence = INTERSTITIAL_COMPLETION_CADENCE,
}: DecideInterstitialInput): InterstitialTrigger {
  if (outcome === "loss") {
    return "after-loss";
  }

  if (outcome !== "win") {
    return "none";
  }

  const hasNextLevel = nextLevelIndex !== null && nextLevelIndex > currentLevelIndex;
  if (hasNextLevel && currentTheme !== nextTheme) {
    return "chapter-boundary";
  }

  if (!didCompleteNewLevel) {
    return "none";
  }

  if (completedLevelsCount > 0 && completedLevelsCount % cadence === 0) {
    return "periodic-win";
  }

  return "none";
}

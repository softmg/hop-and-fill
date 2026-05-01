import { ysdkLoad, ysdkSave } from "@/sdk/yandex";

export const PLAYER_PROGRESS_KEY = "crash-cubes:progress";
const LEGACY_TUTORIAL_KEY = "hasSeenTutorial";

export interface PlayerProgress {
  version: 1;
  unlockedLevel: number;
  completedLevels: number[];
  bestStarsByLevel: Record<number, 1 | 2 | 3>;
  tutorialComplete: boolean;
}

export function createDefaultProgress(): PlayerProgress {
  return {
    version: 1,
    unlockedLevel: 1,
    completedLevels: [],
    bestStarsByLevel: {},
    tutorialComplete: false,
  };
}

function clampLevelNumber(value: number, levelCount: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(levelCount, Math.max(1, Math.trunc(value)));
}

function sanitizeLevelNumbers(value: unknown, levelCount: number) {
  if (!Array.isArray(value)) return [];
  const numbers = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= levelCount);
  return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

function sanitizeBestStars(value: unknown, levelCount: number) {
  if (!value || typeof value !== "object") return {};

  const result: PlayerProgress["bestStarsByLevel"] = {};
  for (const [key, rawStars] of Object.entries(value as Record<string, unknown>)) {
    const levelNumber = Number(key);
    const stars = Number(rawStars);
    if (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > levelCount) continue;
    if (stars !== 1 && stars !== 2 && stars !== 3) continue;
    result[levelNumber] = stars;
  }
  return result;
}

function hasLegacyTutorialCompletion() {
  try {
    return localStorage.getItem(LEGACY_TUTORIAL_KEY) === "true";
  } catch {
    return false;
  }
}

export function normalizeProgress(raw: unknown, levelCount: number): PlayerProgress {
  const fallback = createDefaultProgress();
  if (levelCount <= 0) return fallback;
  if (!raw || typeof raw !== "object") {
    return {
      ...fallback,
      tutorialComplete: hasLegacyTutorialCompletion(),
    };
  }

  const data = raw as Partial<PlayerProgress>;
  const completedLevels = sanitizeLevelNumbers(data.completedLevels, levelCount);
  const bestStarsByLevel = sanitizeBestStars(data.bestStarsByLevel, levelCount);
  const highestCompleted = completedLevels.length > 0 ? Math.max(...completedLevels) : 0;
  const unlockedLevel = Math.max(
    clampLevelNumber(Number(data.unlockedLevel), levelCount),
    Math.min(levelCount, highestCompleted + 1 || 1),
  );

  return {
    version: 1,
    unlockedLevel,
    completedLevels,
    bestStarsByLevel,
    tutorialComplete: Boolean(data.tutorialComplete) || hasLegacyTutorialCompletion(),
  };
}

export function isLevelUnlocked(progress: PlayerProgress, levelIndex: number) {
  const levelNumber = levelIndex + 1;
  return levelNumber <= progress.unlockedLevel || progress.completedLevels.includes(levelNumber);
}

export function getBestStars(progress: PlayerProgress, levelIndex: number) {
  return progress.bestStarsByLevel[levelIndex + 1] ?? 0;
}

export function getTotalStars(progress: PlayerProgress) {
  return Object.values(progress.bestStarsByLevel).reduce((sum, stars) => sum + stars, 0);
}

export function completeLevel(
  progress: PlayerProgress,
  levelIndex: number,
  stars: 1 | 2 | 3,
  levelCount: number,
): PlayerProgress {
  const levelNumber = levelIndex + 1;
  const completedLevels = Array.from(new Set([...progress.completedLevels, levelNumber])).sort((a, b) => a - b);
  const previousBest = progress.bestStarsByLevel[levelNumber] ?? 0;

  return normalizeProgress(
    {
      ...progress,
      unlockedLevel: Math.max(progress.unlockedLevel, Math.min(levelCount, levelNumber + 1)),
      completedLevels,
      bestStarsByLevel: {
        ...progress.bestStarsByLevel,
        [levelNumber]: Math.max(previousBest, stars),
      },
    },
    levelCount,
  );
}

export function completeTutorial(progress: PlayerProgress, levelCount: number): PlayerProgress {
  return normalizeProgress(
    {
      ...progress,
      tutorialComplete: true,
    },
    levelCount,
  );
}

export async function loadPlayerProgress(levelCount: number): Promise<PlayerProgress> {
  try {
    const data = await ysdkLoad([PLAYER_PROGRESS_KEY]);
    return normalizeProgress(data[PLAYER_PROGRESS_KEY], levelCount);
  } catch (error) {
    console.warn("[progress] failed to load player progress", error);
    return normalizeProgress(null, levelCount);
  }
}

export async function savePlayerProgress(progress: PlayerProgress) {
  await ysdkSave({ [PLAYER_PROGRESS_KEY]: progress });
}

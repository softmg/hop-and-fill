import { ysdkLoad, ysdkSave } from "@/sdk/yandex";

export const PLAYER_PROGRESS_KEY = "crash-cubes:progress";
const LEGACY_TUTORIAL_KEY = "hasSeenTutorial";

export const RACE_TIME_LIMITS_SECONDS = [
  5,
  6,
  15,
  15,
  30,
  20,
  18,
  19,
  30,
  44,
  25,
  25,
  34,
  32,
  40,
  52,
  55,
  50,
  60,
  47,
  32,
  67,
  69,
  77,
  80,
] as const;
export const MAX_RACE_AWARDS = RACE_TIME_LIMITS_SECONDS.length;

export interface PlayerProgress {
  version: 1;
  unlockedLevel: number;
  completedLevels: number[];
  bestStarsByLevel: Record<number, 1 | 2 | 3>;
  bestTimeMsByLevel: Record<number, number>;
  hasStarted: boolean;
  tutorialComplete: boolean;
  audioMuted: boolean;
}

export function createDefaultProgress(): PlayerProgress {
  return {
    version: 1,
    unlockedLevel: 1,
    completedLevels: [],
    bestStarsByLevel: {},
    bestTimeMsByLevel: {},
    hasStarted: false,
    tutorialComplete: false,
    audioMuted: false,
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

function sanitizeBestTimes(value: unknown, levelCount: number) {
  if (!value || typeof value !== "object") return {};

  const result: PlayerProgress["bestTimeMsByLevel"] = {};
  for (const [key, rawTimeMs] of Object.entries(value as Record<string, unknown>)) {
    const levelNumber = Number(key);
    const timeMs = Number(rawTimeMs);
    if (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > levelCount) continue;
    if (!Number.isFinite(timeMs) || timeMs <= 0) continue;
    result[levelNumber] = Math.trunc(timeMs);
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

function sanitizeAudioMuted(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

export function normalizeProgress(raw: unknown, levelCount: number): PlayerProgress {
  const fallback = createDefaultProgress();
  const legacyTutorialComplete = hasLegacyTutorialCompletion();
  if (levelCount <= 0) return fallback;
  if (!raw || typeof raw !== "object") {
    return {
      ...fallback,
      hasStarted: legacyTutorialComplete,
      tutorialComplete: legacyTutorialComplete,
    };
  }

  const data = raw as Partial<PlayerProgress>;
  const completedLevels = sanitizeLevelNumbers(data.completedLevels, levelCount);
  const bestStarsByLevel = sanitizeBestStars(data.bestStarsByLevel, levelCount);
  const bestTimeMsByLevel = sanitizeBestTimes(data.bestTimeMsByLevel, levelCount);
  const highestCompleted = completedLevels.length > 0 ? Math.max(...completedLevels) : 0;
  const unlockedLevel = Math.max(
    clampLevelNumber(Number(data.unlockedLevel), levelCount),
    Math.min(levelCount, highestCompleted + 1 || 1),
  );
  const hasStoredProgress =
    unlockedLevel > 1 ||
    completedLevels.length > 0 ||
    Object.keys(bestStarsByLevel).length > 0 ||
    Object.keys(bestTimeMsByLevel).length > 0 ||
    Boolean(data.tutorialComplete) ||
    legacyTutorialComplete;

  return {
    version: 1,
    unlockedLevel,
    completedLevels,
    bestStarsByLevel,
    bestTimeMsByLevel,
    hasStarted: Boolean(data.hasStarted) || hasStoredProgress,
    tutorialComplete: Boolean(data.tutorialComplete) || legacyTutorialComplete,
    audioMuted: sanitizeAudioMuted(data.audioMuted),
  };
}

export function isLevelUnlocked(progress: PlayerProgress, levelIndex: number) {
  const levelNumber = levelIndex + 1;
  return levelNumber <= progress.unlockedLevel || progress.completedLevels.includes(levelNumber);
}

export function getBestStars(progress: PlayerProgress, levelIndex: number) {
  return progress.bestStarsByLevel[levelIndex + 1] ?? 0;
}

export function getBestTimeMs(progress: PlayerProgress, levelIndex: number) {
  return progress.bestTimeMsByLevel[levelIndex + 1] ?? null;
}

export function getRaceTimeLimitMs(levelIndex: number) {
  const seconds = RACE_TIME_LIMITS_SECONDS[levelIndex];
  return seconds === undefined ? null : seconds * 1000;
}

export function getMaxRaces(levelCount: number) {
  if (!Number.isFinite(levelCount) || levelCount <= 0) return 0;
  return Math.min(Math.trunc(levelCount), MAX_RACE_AWARDS);
}

export function hasRaceAward(progress: PlayerProgress, levelIndex: number) {
  const timeLimitMs = getRaceTimeLimitMs(levelIndex);
  const bestTimeMs = getBestTimeMs(progress, levelIndex);
  return timeLimitMs !== null && bestTimeMs !== null && bestTimeMs <= timeLimitMs;
}

export function getTotalRaces(progress: PlayerProgress, levelCount = MAX_RACE_AWARDS) {
  const maxRaces = getMaxRaces(levelCount);
  let total = 0;

  for (let levelIndex = 0; levelIndex < maxRaces; levelIndex++) {
    if (hasRaceAward(progress, levelIndex)) total += 1;
  }

  return total;
}

export function getTotalStars(progress: PlayerProgress) {
  return Object.values(progress.bestStarsByLevel).reduce((sum, stars) => sum + stars, 0);
}

export function completeLevel(
  progress: PlayerProgress,
  levelIndex: number,
  stars: 1 | 2 | 3,
  levelCount: number,
  completionTimeMs?: number,
): PlayerProgress {
  const levelNumber = levelIndex + 1;
  const completedLevels = Array.from(new Set([...progress.completedLevels, levelNumber])).sort((a, b) => a - b);
  const previousBest = progress.bestStarsByLevel[levelNumber] ?? 0;
  const previousBestTime = progress.bestTimeMsByLevel?.[levelNumber];
  const normalizedCompletionTime =
    typeof completionTimeMs === "number" && Number.isFinite(completionTimeMs) && completionTimeMs > 0
      ? Math.trunc(completionTimeMs)
      : null;
  const nextBestTime =
    normalizedCompletionTime === null
      ? previousBestTime
      : previousBestTime === undefined
        ? normalizedCompletionTime
        : Math.min(previousBestTime, normalizedCompletionTime);

  return normalizeProgress(
    {
      ...progress,
      unlockedLevel: Math.max(progress.unlockedLevel, Math.min(levelCount, levelNumber + 1)),
      completedLevels,
      bestStarsByLevel: {
        ...progress.bestStarsByLevel,
        [levelNumber]: Math.max(previousBest, stars),
      },
      bestTimeMsByLevel: {
        ...progress.bestTimeMsByLevel,
        ...(nextBestTime === undefined ? {} : { [levelNumber]: nextBestTime }),
      },
    },
    levelCount,
  );
}

export function completeTutorial(progress: PlayerProgress, levelCount: number): PlayerProgress {
  return normalizeProgress(
    {
      ...progress,
      hasStarted: true,
      tutorialComplete: true,
    },
    levelCount,
  );
}

export function markGameStarted(progress: PlayerProgress, levelCount: number): PlayerProgress {
  return normalizeProgress(
    {
      ...progress,
      hasStarted: true,
    },
    levelCount,
  );
}

export function setAudioMuted(progress: PlayerProgress, muted: boolean, levelCount: number): PlayerProgress {
  return normalizeProgress(
    {
      ...progress,
      audioMuted: muted,
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

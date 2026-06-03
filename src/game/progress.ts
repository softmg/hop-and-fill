import { ysdkIsPlayerAuthorized, ysdkLoad, ysdkSave } from "@/platform/yandexGames";

export const PLAYER_PROGRESS_KEY = "crash-cubes:progress";
const LEGACY_TUTORIAL_KEY = "hasSeenTutorial";
let saveQueue: Promise<void> = Promise.resolve();

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

/** Creates the canonical empty progress record for a fresh player. */
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

function loadLocalProgress() {
  try {
    return JSON.parse(localStorage.getItem(PLAYER_PROGRESS_KEY) || "null");
  } catch {
    return null;
  }
}

function saveLocalProgress(progress: PlayerProgress) {
  try {
    localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be blocked by browser privacy settings.
  }
}

function clearLocalProgress() {
  try {
    localStorage.removeItem(PLAYER_PROGRESS_KEY);
  } catch {
    // Storage can be blocked by browser privacy settings.
  }
}

function mergeBestStars(
  left: PlayerProgress["bestStarsByLevel"],
  right: PlayerProgress["bestStarsByLevel"],
): PlayerProgress["bestStarsByLevel"] {
  const result = { ...left };

  for (const [key, stars] of Object.entries(right)) {
    const levelNumber = Number(key);
    const existingStars = result[levelNumber] ?? 0;
    result[levelNumber] = Math.max(existingStars, stars) as 1 | 2 | 3;
  }

  return result;
}

function mergeBestTimes(
  left: PlayerProgress["bestTimeMsByLevel"],
  right: PlayerProgress["bestTimeMsByLevel"],
): PlayerProgress["bestTimeMsByLevel"] {
  const result = { ...left };

  for (const [key, timeMs] of Object.entries(right)) {
    const levelNumber = Number(key);
    const existingTimeMs = result[levelNumber];
    result[levelNumber] = existingTimeMs === undefined ? timeMs : Math.min(existingTimeMs, timeMs);
  }

  return result;
}

function hasAudioMutedValue(value: unknown) {
  return Boolean(value && typeof value === "object" && typeof (value as Partial<PlayerProgress>).audioMuted === "boolean");
}

/** Normalizes untrusted persisted data into a bounded PlayerProgress value. */
export function normalizeProgress(
  raw: unknown,
  levelCount: number,
  options: { allowLegacyTutorial?: boolean } = {},
): PlayerProgress {
  const fallback = createDefaultProgress();
  const legacyTutorialComplete = options.allowLegacyTutorial === false ? false : hasLegacyTutorialCompletion();
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

/** Merges guest and stored progress by keeping the best unlocked, star, and time records. */
export function mergeProgress(
  currentRaw: unknown,
  storedRaw: unknown,
  levelCount: number,
): PlayerProgress {
  const current = normalizeProgress(currentRaw, levelCount);
  const stored = normalizeProgress(storedRaw, levelCount);

  return normalizeProgress(
    {
      ...stored,
      unlockedLevel: Math.max(current.unlockedLevel, stored.unlockedLevel),
      completedLevels: [...current.completedLevels, ...stored.completedLevels],
      bestStarsByLevel: mergeBestStars(current.bestStarsByLevel, stored.bestStarsByLevel),
      bestTimeMsByLevel: mergeBestTimes(current.bestTimeMsByLevel, stored.bestTimeMsByLevel),
      hasStarted: current.hasStarted || stored.hasStarted,
      tutorialComplete: current.tutorialComplete || stored.tutorialComplete,
      audioMuted: hasAudioMutedValue(currentRaw) ? current.audioMuted : stored.audioMuted,
    },
    levelCount,
  );
}

/** Returns whether a zero-based level index can be selected by the player. */
export function isLevelUnlocked(progress: PlayerProgress, levelIndex: number) {
  const levelNumber = levelIndex + 1;
  return levelNumber <= progress.unlockedLevel || progress.completedLevels.includes(levelNumber);
}

/** Returns the best star result for a zero-based level index. */
export function getBestStars(progress: PlayerProgress, levelIndex: number) {
  return progress.bestStarsByLevel[levelIndex + 1] ?? 0;
}

/** Returns the best completion time for a zero-based level index, if one exists. */
export function getBestTimeMs(progress: PlayerProgress, levelIndex: number) {
  return progress.bestTimeMsByLevel[levelIndex + 1] ?? null;
}

/** Returns the race award time limit for a zero-based level index, if configured. */
export function getRaceTimeLimitMs(levelIndex: number) {
  const seconds = RACE_TIME_LIMITS_SECONDS[levelIndex];
  return seconds === undefined ? null : seconds * 1000;
}

/** Returns the number of levels that can currently award race medals. */
export function getMaxRaces(levelCount: number) {
  if (!Number.isFinite(levelCount) || levelCount <= 0) return 0;
  return Math.min(Math.trunc(levelCount), MAX_RACE_AWARDS);
}

/** Returns whether the saved best time qualifies for the race award. */
export function hasRaceAward(progress: PlayerProgress, levelIndex: number) {
  const timeLimitMs = getRaceTimeLimitMs(levelIndex);
  const bestTimeMs = getBestTimeMs(progress, levelIndex);
  return timeLimitMs !== null && bestTimeMs !== null && bestTimeMs <= timeLimitMs;
}

/** Counts race awards across the configured level range. */
export function getTotalRaces(progress: PlayerProgress, levelCount: number = MAX_RACE_AWARDS) {
  const maxRaces = getMaxRaces(levelCount);
  let total = 0;

  for (let levelIndex = 0; levelIndex < maxRaces; levelIndex++) {
    if (hasRaceAward(progress, levelIndex)) total += 1;
  }

  return total;
}

/** Counts all saved stars across completed levels. */
export function getTotalStars(progress: PlayerProgress) {
  return Object.values(progress.bestStarsByLevel).reduce((sum, stars) => sum + stars, 0);
}

/** Applies a level completion result and unlocks the next level when available. */
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

/** Marks tutorial onboarding as completed. */
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

/** Marks that the player has started the game at least once. */
export function markGameStarted(progress: PlayerProgress, levelCount: number): PlayerProgress {
  return normalizeProgress(
    {
      ...progress,
      hasStarted: true,
    },
    levelCount,
  );
}

/** Updates the saved audio preference without changing gameplay progress. */
export function setAudioMuted(progress: PlayerProgress, muted: boolean, levelCount: number): PlayerProgress {
  return normalizeProgress(
    {
      ...progress,
      audioMuted: muted,
    },
    levelCount,
  );
}

/** Loads progress from cloud storage when authorized, falling back to local guest data on any SDK failure. */
export async function loadPlayerProgress(levelCount: number): Promise<PlayerProgress> {
  const localProgress = loadLocalProgress();
  let isAuthorized = false;

  try {
    isAuthorized = await ysdkIsPlayerAuthorized();
  } catch (error) {
    console.warn("[progress] failed to read Yandex authorization state", error);
    return normalizeProgress(localProgress, levelCount);
  }

  if (!isAuthorized) {
    return normalizeProgress(localProgress, levelCount);
  }

  try {
    const data = await ysdkLoad([PLAYER_PROGRESS_KEY]);
    const progress = mergeProgress(localProgress, data[PLAYER_PROGRESS_KEY], levelCount);
    clearLocalProgress();
    return normalizeProgress(progress, levelCount, { allowLegacyTutorial: false });
  } catch (error) {
    console.warn("[progress] failed to load cloud player progress", error);
    return normalizeProgress(localProgress, levelCount);
  }
}

/** Saves progress to cloud storage when authorized, preserving a local copy when cloud writes fail. */
async function savePlayerProgressNow(progress: PlayerProgress) {
  let isAuthorized = false;
  try {
    isAuthorized = await ysdkIsPlayerAuthorized();
  } catch (error) {
    console.warn("[progress] failed to read Yandex authorization state", error);
    saveLocalProgress(progress);
    return;
  }

  if (!isAuthorized) {
    saveLocalProgress(progress);
    return;
  }

  try {
    await ysdkSave({ [PLAYER_PROGRESS_KEY]: progress });
    clearLocalProgress();
  } catch (error) {
    console.warn("[progress] failed to save cloud player progress", error);
    saveLocalProgress(progress);
  }
}

/** Queues progress writes so cloud storage requests never overlap. */
export async function savePlayerProgress(progress: PlayerProgress) {
  const task = saveQueue.catch(() => undefined).then(() => savePlayerProgressNow(progress));
  saveQueue = task.catch(() => undefined);
  return task;
}

/** Merges guest progress into cloud storage and keeps local data if migration cannot complete. */
export async function migrateGuestProgressToCloud(progress: PlayerProgress, levelCount: number) {
  try {
    const data = await ysdkLoad([PLAYER_PROGRESS_KEY]);
    const syncedProgress = mergeProgress(progress, data[PLAYER_PROGRESS_KEY], levelCount);

    await ysdkSave({ [PLAYER_PROGRESS_KEY]: syncedProgress });
    clearLocalProgress();
    return syncedProgress;
  } catch (error) {
    console.warn("[progress] failed to migrate guest progress to cloud", error);
    saveLocalProgress(progress);
    return normalizeProgress(progress, levelCount);
  }
}

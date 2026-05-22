import { ysdkGetLeaderboardEntries, ysdkSetLeaderboardScore, type YsdkLeaderboardEntry } from "@/platform/yandexGames";
import { hasLeaderboardBackend, loadBackendLeaderboardSnapshot, saveBackendLeaderboardScore } from "./leaderboardBackend";
import { getTotalStars, type PlayerProgress } from "./progress";

export const DEFAULT_LEADERBOARD_NAME = "crash_cubes_total_stars";
export const LEADERBOARD_NAME = import.meta.env.VITE_YANDEX_LEADERBOARD_NAME || DEFAULT_LEADERBOARD_NAME;
export const LEADERBOARDS_ENABLED = import.meta.env.MODE !== "yandex";
export const LEADERBOARD_TOP_SIZE = 10;
export const LEADERBOARD_AROUND_SIZE = 3;

interface LeaderboardExtraData {
  version: 1;
  completedLevels: number;
  levelCount: number;
  totalStars: number;
  maxStars: number;
  totalBestTimeMs: number | null;
}

export interface LeaderboardRow {
  rank: number;
  score: number;
  publicName: string;
  avatarSrc: string | null;
  uniqueID: string | null;
  completedLevels: number | null;
  levelCount: number | null;
  totalBestTimeMs: number | null;
  isCurrentUser: boolean;
}

export interface LeaderboardSnapshot {
  entries: LeaderboardRow[];
  userRank: number | null;
}

function getTotalBestTimeMs(progress: PlayerProgress) {
  const times = Object.values(progress.bestTimeMsByLevel).filter((timeMs) => Number.isFinite(timeMs) && timeMs > 0);
  if (times.length === 0) return null;
  return times.reduce((sum, timeMs) => sum + Math.trunc(timeMs), 0);
}

function parseExtraData(extraData: unknown): Partial<LeaderboardExtraData> {
  if (typeof extraData !== "string" || extraData.length === 0) return {};

  try {
    const parsed = JSON.parse(extraData) as Partial<LeaderboardExtraData>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function createExtraData(progress: PlayerProgress, levelCount: number): string {
  const totalStars = calculateLeaderboardScore(progress);
  const data: LeaderboardExtraData = {
    version: 1,
    completedLevels: progress.completedLevels.length,
    levelCount,
    totalStars,
    maxStars: levelCount * 3,
    totalBestTimeMs: getTotalBestTimeMs(progress),
  };

  return JSON.stringify(data);
}

function normalizeLeaderboardEntry(entry: YsdkLeaderboardEntry, userRank: number | null): LeaderboardRow {
  const extraData = parseExtraData(entry.extraData);
  const completedLevels = Number(extraData.completedLevels);
  const levelCount = Number(extraData.levelCount);
  const totalBestTimeMs = Number(extraData.totalBestTimeMs);
  const publicName = entry.player.publicName?.trim() || "Игрок";
  const avatarSrc = entry.player.getAvatarSrc?.("small") || null;

  return {
    rank: entry.rank,
    score: Math.max(0, Math.trunc(Number(entry.score) || 0)),
    publicName,
    avatarSrc,
    uniqueID: entry.player.uniqueID ?? null,
    completedLevels: Number.isFinite(completedLevels) ? Math.max(0, Math.trunc(completedLevels)) : null,
    levelCount: Number.isFinite(levelCount) ? Math.max(0, Math.trunc(levelCount)) : null,
    totalBestTimeMs: Number.isFinite(totalBestTimeMs) && totalBestTimeMs > 0 ? Math.trunc(totalBestTimeMs) : null,
    isCurrentUser: userRank !== null && userRank > 0 && entry.rank === userRank,
  };
}

export function calculateLeaderboardScore(progress: PlayerProgress) {
  return Math.max(0, Math.trunc(getTotalStars(progress)));
}

export async function saveLeaderboardScore(
  progress: PlayerProgress,
  levelCount: number,
  options?: { requestAuthorization?: boolean },
) {
  const score = calculateLeaderboardScore(progress);
  if (score <= 0) {
    return { status: "skipped" as const, score };
  }

  const extraData = createExtraData(progress, levelCount);

  if (hasLeaderboardBackend()) {
    await saveBackendLeaderboardScore(LEADERBOARD_NAME, { score, extraData });
  } else {
    await ysdkSetLeaderboardScore(LEADERBOARD_NAME, score, extraData, options);
  }

  return { status: "saved" as const, score };
}

export async function loadLeaderboardSnapshot(): Promise<LeaderboardSnapshot> {
  const options = {
    includeUser: true,
    quantityAround: LEADERBOARD_AROUND_SIZE,
    quantityTop: LEADERBOARD_TOP_SIZE,
  };
  const data = hasLeaderboardBackend()
    ? await loadBackendLeaderboardSnapshot(LEADERBOARD_NAME, options)
    : await ysdkGetLeaderboardEntries(LEADERBOARD_NAME, options);
  const userRank = data.userRank && data.userRank > 0 ? data.userRank : null;

  return {
    userRank,
    entries: data.entries.map((entry) => normalizeLeaderboardEntry(entry, userRank)),
  };
}

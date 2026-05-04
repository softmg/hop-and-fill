import type { YsdkLeaderboardEntries, YsdkLeaderboardEntry } from "@/sdk/yandex";

export const LEADERBOARD_BACKEND_URL = String(import.meta.env.VITE_LEADERBOARD_BACKEND_URL ?? "").trim();

interface BackendLeaderboardPlayer {
  publicName?: unknown;
  uniqueID?: unknown;
  id?: unknown;
  avatarSrc?: unknown;
  avatarUrl?: unknown;
}

interface BackendLeaderboardEntry {
  extraData?: unknown;
  rank?: unknown;
  score?: unknown;
  publicName?: unknown;
  uniqueID?: unknown;
  id?: unknown;
  avatarSrc?: unknown;
  avatarUrl?: unknown;
  player?: BackendLeaderboardPlayer;
}

export function hasLeaderboardBackend() {
  return LEADERBOARD_BACKEND_URL.length > 0;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function getBaseUrl() {
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const normalizedBase = LEADERBOARD_BACKEND_URL.endsWith("/")
    ? LEADERBOARD_BACKEND_URL
    : `${LEADERBOARD_BACKEND_URL}/`;

  return new URL(normalizedBase, origin);
}

function createBackendUrl(path: string, query?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path.replace(/^\/+/, ""), getBaseUrl());

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Leaderboard backend request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text.length > 0 ? JSON.parse(text) : undefined) as T;
}

function normalizeBackendEntry(entry: BackendLeaderboardEntry, index: number): YsdkLeaderboardEntry {
  const player = entry.player ?? {};
  const avatarSrc = optionalString(player.avatarSrc ?? player.avatarUrl ?? entry.avatarSrc ?? entry.avatarUrl);
  const uniqueID = optionalString(player.uniqueID ?? player.id ?? entry.uniqueID ?? entry.id);
  const publicName = optionalString(player.publicName ?? entry.publicName);
  const rank = Number(entry.rank);
  const score = Number(entry.score);

  return {
    rank: Number.isFinite(rank) && rank > 0 ? Math.trunc(rank) : index + 1,
    score: Number.isFinite(score) ? Math.max(0, Math.trunc(score)) : 0,
    extraData: optionalString(entry.extraData),
    player: {
      publicName,
      uniqueID,
      getAvatarSrc: avatarSrc ? () => avatarSrc : undefined,
      getAvatarSrcSet: avatarSrc ? () => avatarSrc : undefined,
    },
  };
}

function normalizeBackendEntries(data: unknown): YsdkLeaderboardEntries {
  const source = data && typeof data === "object" ? data as { userRank?: unknown; entries?: unknown } : {};
  const rawEntries = Array.isArray(data) ? data : Array.isArray(source.entries) ? source.entries : [];
  const userRank = Number(source.userRank);

  return {
    userRank: Number.isFinite(userRank) && userRank > 0 ? Math.trunc(userRank) : 0,
    entries: rawEntries.map((entry, index) => normalizeBackendEntry(entry as BackendLeaderboardEntry, index)),
  };
}

export async function saveBackendLeaderboardScore(
  leaderboardName: string,
  payload: {
    score: number;
    extraData?: string;
  },
) {
  const url = createBackendUrl(`leaderboards/${encodeURIComponent(leaderboardName)}/scores`);
  await requestJson<void>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      leaderboardName,
      score: payload.score,
      extraData: payload.extraData,
    }),
  });
}

export async function loadBackendLeaderboardSnapshot(
  leaderboardName: string,
  options?: {
    includeUser?: boolean;
    quantityAround?: number;
    quantityTop?: number;
  },
) {
  const url = createBackendUrl(`leaderboards/${encodeURIComponent(leaderboardName)}/entries`, options);
  const data = await requestJson<unknown>(url, {
    method: "GET",
  });

  return normalizeBackendEntries(data);
}

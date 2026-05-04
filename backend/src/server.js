import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 8787);
const STORE_PATH = resolve(process.env.LEADERBOARD_STORE_PATH || resolve(__dirname, "../data/leaderboards.json"));
const PLAYER_HEADER = "x-crash-cubes-player-id";
const MAX_BODY_BYTES = 32 * 1024;
const DEFAULT_PLAYER_NAME = "Игрок";

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (configuredOrigins.includes("*") || configuredOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1" ||
        url.hostname.endsWith(".cloudpub.ru")
      )
    );
  } catch {
    return false;
  }
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", `Content-Type, ${PLAYER_HEADER}`);
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

async function readJsonBody(req) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body is too large"), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { statusCode: 400 });
  }
}

async function readStore() {
  try {
    const content = await readFile(STORE_PATH, "utf8");
    if (content.trim().length === 0) {
      return { leaderboards: {} };
    }

    const data = JSON.parse(content);
    return data && typeof data === "object" ? data : { leaderboards: {} };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { leaderboards: {} };
    }
    throw error;
  }
}

async function writeStore(store) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  const tempPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(tempPath, STORE_PATH);
}

function getLeaderboard(store, leaderboardName) {
  store.leaderboards ??= {};
  store.leaderboards[leaderboardName] ??= { entries: [] };
  store.leaderboards[leaderboardName].entries ??= [];
  return store.leaderboards[leaderboardName];
}

function getPlayerId(req) {
  const headerValue = req.headers[PLAYER_HEADER];
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return typeof candidate === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(candidate)
    ? candidate
    : randomUUID();
}

function getPublicName(body) {
  if (typeof body.publicName !== "string") return DEFAULT_PLAYER_NAME;
  const name = body.publicName.trim();
  return name.length > 0 ? name.slice(0, 48) : DEFAULT_PLAYER_NAME;
}

function getScore(body) {
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0) {
    throw Object.assign(new Error("Score must be a non-negative number"), { statusCode: 400 });
  }
  return Math.trunc(score);
}

function getExtraData(body) {
  if (body.extraData === undefined || body.extraData === null) return undefined;
  if (typeof body.extraData !== "string") {
    throw Object.assign(new Error("extraData must be a string"), { statusCode: 400 });
  }
  return body.extraData.slice(0, 4096);
}

function parseQuantity(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.updatedAt).localeCompare(String(b.updatedAt));
  });
}

function toRankedEntries(entries) {
  return sortEntries(entries).map((entry, index) => ({
    rank: index + 1,
    score: entry.score,
    extraData: entry.extraData,
    player: {
      publicName: entry.publicName || DEFAULT_PLAYER_NAME,
      uniqueID: entry.uniqueID,
      avatarSrc: entry.avatarSrc,
    },
  }));
}

function selectEntries(entries, playerId, options) {
  const rankedEntries = toRankedEntries(entries);
  const quantityTop = parseQuantity(options.searchParams.get("quantityTop"), 10, 1, 20);
  const quantityAround = parseQuantity(options.searchParams.get("quantityAround"), 3, 1, 10);
  const includeUser = options.searchParams.get("includeUser") === "true";
  const userIndex = rankedEntries.findIndex((entry) => entry.player.uniqueID === playerId);
  const userRank = userIndex >= 0 ? rankedEntries[userIndex].rank : 0;
  const selected = rankedEntries.slice(0, quantityTop);

  if (includeUser && userIndex >= 0) {
    const start = Math.max(0, userIndex - quantityAround);
    const end = Math.min(rankedEntries.length, userIndex + quantityAround + 1);

    for (const entry of rankedEntries.slice(start, end)) {
      if (!selected.some((selectedEntry) => selectedEntry.player.uniqueID === entry.player.uniqueID)) {
        selected.push(entry);
      }
    }
  }

  return {
    playerId,
    userRank,
    entries: selected.sort((a, b) => a.rank - b.rank),
  };
}

function extractLeaderboardName(pathname, suffix) {
  const match = pathname.match(/^\/leaderboards\/([^/]+)\/([^/]+)$/);
  if (!match || match[2] !== suffix) return null;
  return decodeURIComponent(match[1]);
}

async function handleSaveScore(req, res, leaderboardName) {
  const body = await readJsonBody(req);
  const playerId = getPlayerId(req);
  const score = getScore(body);
  const extraData = getExtraData(body);
  const publicName = getPublicName(body);
  const now = new Date().toISOString();
  const store = await readStore();
  const leaderboard = getLeaderboard(store, leaderboardName);
  const existingIndex = leaderboard.entries.findIndex((entry) => entry.uniqueID === playerId);
  const existing = existingIndex >= 0 ? leaderboard.entries[existingIndex] : null;
  const nextEntry = {
    uniqueID: playerId,
    publicName: existing?.publicName || publicName,
    avatarSrc: existing?.avatarSrc,
    score: existing ? Math.max(existing.score, score) : score,
    extraData,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    leaderboard.entries[existingIndex] = nextEntry;
  } else {
    leaderboard.entries.push(nextEntry);
  }

  await writeStore(store);

  const rankedEntries = toRankedEntries(leaderboard.entries);
  const savedEntry = rankedEntries.find((entry) => entry.player.uniqueID === playerId);
  sendJson(res, 200, {
    status: "saved",
    playerId,
    score: nextEntry.score,
    rank: savedEntry?.rank ?? 0,
  });
}

async function handleGetEntries(req, res, url, leaderboardName) {
  const playerId = getPlayerId(req);
  const store = await readStore();
  const leaderboard = getLeaderboard(store, leaderboardName);
  sendJson(res, 200, selectEntries(leaderboard.entries, playerId, url));
}

async function handleRequest(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    const scoreLeaderboardName = extractLeaderboardName(url.pathname, "scores");
    if (req.method === "POST" && scoreLeaderboardName) {
      await handleSaveScore(req, res, scoreLeaderboardName);
      return;
    }

    const entriesLeaderboardName = extractLeaderboardName(url.pathname, "entries");
    if (req.method === "GET" && entriesLeaderboardName) {
      await handleGetEntries(req, res, url, entriesLeaderboardName);
      return;
    }

    sendError(res, 404, "Not found");
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    if (statusCode >= 500) {
      console.error("[backend] request failed", error);
    }
    sendError(res, statusCode, error?.message || "Internal server error");
  }
}

const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
  console.log(`[backend] leaderboard store: ${STORE_PATH}`);
});

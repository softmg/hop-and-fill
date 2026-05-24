import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { CarFront, Check, Clock3, Map, Pause, Play, RotateCcw, Share2, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { PixiGame } from "@/game/PixiGame";
import { rotateKeyboardDir, type KeyboardRotation } from "@/game/Input";
import type { Dir } from "@/game/iso";
import { createGameAudio } from "@/game/audio";
import { canRequestInterstitial, type InterstitialTrigger } from "@/game/interstitials";
import { getLevelName, levels } from "@/game/levels";
import { deriveChapters, getChapterForLevel, getChapterTransition, getLevelTheme, getThemeLabel, type ChapterTransition } from "@/game/levels/chapters";
import { computeOptimalMoves, computeStars, moveLimit } from "@/game/difficulty";
import {
  subscribeToFullscreenAds,
  ysdkGameplayStart,
  ysdkGameplayStop,
  ysdkIsPlayerAuthorized,
  ysdkReady,
  ysdkRequestAuthorization,
  ysdkShowAd,
  ysdkShowRewardedAd,
} from "@/platform/yandexGames";
import { useLanguage, useTranslation } from "@/platform/i18n";
import { Button } from "@/components/ui/button";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { LevelSelect } from "@/components/LevelSelect";
import { ParallaxBackground, type BgTheme } from "@/components/ParallaxBackground";
import { MobileJoystick } from "@/components/MobileJoystick";
import { StartScreen } from "@/components/StartScreen";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import {
  completeLevel,
  completeTutorial,
  createDefaultProgress,
  getBestStars,
  getBestTimeMs,
  getMaxRaces,
  getRaceTimeLimitMs,
  getTotalRaces,
  getTotalStars,
  hasRaceAward,
  isLevelUnlocked,
  loadPlayerProgress,
  markGameStarted,
  migrateGuestProgressToCloud,
  savePlayerProgress,
  setAudioMuted,
  type PlayerProgress,
} from "@/game/progress";
import { calculateLeaderboardScore, LEADERBOARDS_ENABLED, loadLeaderboardSnapshot, saveLeaderboardScore, type LeaderboardRow } from "@/game/leaderboard";
import { buildSharedResultUrl, createSharedResult, type SharedResultContext } from "@/game/shareResult";
import { formatDurationMs } from "@/game/time";

type OverlayMode = "playing" | "paused" | "won" | "lost" | "chapter" | "final";
type LeaderboardStatus = "idle" | "loading" | "ready" | "error";
type LeaderboardSaveStatus = "idle" | "saving" | "saved" | "error" | "skipped";
type ShareStatus = "idle" | "copied" | "shared" | "error";
type CloudSaveState = "checking" | "guest" | "syncing" | "ready" | "error";
type KeyboardCompassKeyStyle = CSSProperties & {
  "--control-from-left"?: string;
  "--control-from-top"?: string;
  "--control-to-left"?: string;
  "--control-to-top"?: string;
  "--control-delay"?: string;
};

const chapters = deriveChapters(levels);
const REWARDED_EXTRA_MOVES = 10;

type PerfectParticleStyle = CSSProperties & Record<`--perfect-${string}`, string>;

const PERFECT_CONFETTI = [
  { x: "-130px", y: "-90px", rotate: "295deg", delay: "0ms", color: "#facc15", shape: "perfect-confetti--chip" },
  { x: "-92px", y: "-122px", rotate: "35deg", delay: "35ms", color: "#38bdf8", shape: "perfect-confetti--spark" },
  { x: "-46px", y: "-108px", rotate: "145deg", delay: "70ms", color: "#f472b6", shape: "perfect-confetti--chip" },
  { x: "0px", y: "-132px", rotate: "215deg", delay: "20ms", color: "#fef08a", shape: "perfect-confetti--spark" },
  { x: "52px", y: "-112px", rotate: "65deg", delay: "90ms", color: "#34d399", shape: "perfect-confetti--chip" },
  { x: "102px", y: "-96px", rotate: "250deg", delay: "55ms", color: "#fb7185", shape: "perfect-confetti--spark" },
  { x: "134px", y: "-54px", rotate: "115deg", delay: "110ms", color: "#c4b5fd", shape: "perfect-confetti--chip" },
  { x: "-132px", y: "-34px", rotate: "180deg", delay: "125ms", color: "#fde047", shape: "perfect-confetti--spark" },
  { x: "-104px", y: "34px", rotate: "330deg", delay: "80ms", color: "#2dd4bf", shape: "perfect-confetti--chip" },
  { x: "-48px", y: "70px", rotate: "75deg", delay: "150ms", color: "#fb923c", shape: "perfect-confetti--spark" },
  { x: "44px", y: "70px", rotate: "260deg", delay: "135ms", color: "#a3e635", shape: "perfect-confetti--chip" },
  { x: "104px", y: "28px", rotate: "25deg", delay: "100ms", color: "#60a5fa", shape: "perfect-confetti--spark" },
] as const;

const Star = ({ filled, perfectIndex }: { filled: boolean; perfectIndex?: number }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-8 h-8 ${filled ? "text-yellow-400" : "text-muted-foreground/40"} ${perfectIndex !== undefined ? "perfect-star-pop" : ""}`}
    style={perfectIndex !== undefined ? ({ "--perfect-star-index": String(perfectIndex) } as PerfectParticleStyle) : undefined}
    fill="currentColor"
    aria-hidden
  >
    <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1L12 2z" />
  </svg>
);

/**
 * Renders the completion badge shown after a perfect level clear.
 */
const PerfectCelebration = () => (
  <div className="perfect-celebration" data-testid="perfect-celebration" aria-hidden>
    <div className="perfect-celebration__burst" />
    {PERFECT_CONFETTI.map((piece, index) => (
      <span
        key={`${piece.x}-${piece.y}-${index}`}
        className={`perfect-confetti ${piece.shape}`}
        style={{
          "--perfect-x": piece.x,
          "--perfect-y": piece.y,
          "--perfect-rotate": piece.rotate,
          "--perfect-delay": piece.delay,
          "--perfect-color": piece.color,
        } as PerfectParticleStyle}
      />
    ))}
  </div>
);

const KEYBOARD_COMPASS_KEYS = [
  { key: "\u2191", dir: "NW", tone: "arrow", delay: "0ms" },
  { key: "W", dir: "N", tone: "wasd", delay: "45ms" },
  { key: "\u2192", dir: "NE", tone: "arrow", delay: "90ms" },
  { key: "D", dir: "E", tone: "wasd", delay: "135ms" },
  { key: "\u2193", dir: "SE", tone: "arrow", delay: "180ms" },
  { key: "S", dir: "S", tone: "wasd", delay: "225ms" },
  { key: "\u2190", dir: "SW", tone: "arrow", delay: "270ms" },
  { key: "A", dir: "W", tone: "wasd", delay: "315ms" },
] as const;

const ISO_HINT_POSITIONS: Record<Dir, { left: string; top: string }> = {
  NW: { left: "50%", top: "8%" },
  N: { left: "71%", top: "27%" },
  NE: { left: "92%", top: "50%" },
  E: { left: "71%", top: "73%" },
  SE: { left: "50%", top: "92%" },
  S: { left: "29%", top: "73%" },
  SW: { left: "8%", top: "50%" },
  W: { left: "29%", top: "27%" },
};

/**
 * Shows the keyboard-to-isometric direction map and rotation toggle.
 */
const KeyboardCompassControl = ({
  rotation,
  onToggleRotation,
  animateRotationHint = false,
}: {
  rotation: KeyboardRotation;
  onToggleRotation: () => void;
  animateRotationHint?: boolean;
}) => (
  <div className={`absolute left-3 top-[9rem] hidden h-36 w-[18.25rem] sm:block lg:left-4 lg:top-[9.5rem] ${animateRotationHint ? "z-50" : "z-30"}`}>
    <div
      className="pointer-events-none absolute left-0 top-0 h-36 w-56"
      role="img"
      aria-label="Изометрическая подсказка управления: стрелки идут по экранным сторонам, WASD идут по диагоналям поля."
    >
      <div className="absolute inset-x-2 inset-y-1 bg-[linear-gradient(180deg,rgba(82,46,20,0.82),rgba(23,13,7,0.9))] shadow-[0_6px_0_rgba(78,39,14,0.8),0_18px_34px_rgba(0,0,0,0.44),inset_0_2px_0_rgba(255,255,255,0.12)] [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
      <div className="absolute inset-x-2 inset-y-1 border-2 border-[#e0ae6c]/55 bg-[#ffe0a0]/[0.04] [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
      <div className="absolute left-1/2 top-1/2 h-px w-[86%] -translate-x-1/2 -translate-y-1/2 rotate-[32deg] bg-[#ffe0a0]/22" />
      <div className="absolute left-1/2 top-1/2 h-px w-[86%] -translate-x-1/2 -translate-y-1/2 -rotate-[32deg] bg-[#ffe0a0]/22" />
      <div className="absolute left-1/2 top-1/2 h-px w-[82%] -translate-x-1/2 -translate-y-1/2 bg-white/14" />
      <div className="absolute left-1/2 top-1/2 h-[78%] w-px -translate-x-1/2 -translate-y-1/2 bg-white/14" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-200/70 bg-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.55)]" />
      {KEYBOARD_COMPASS_KEYS.map((key) => {
        const position = ISO_HINT_POSITIONS[rotateKeyboardDir(key.dir, rotation)];
        const defaultPosition = ISO_HINT_POSITIONS[rotateKeyboardDir(key.dir, "default")];
        const rotatedPosition = ISO_HINT_POSITIONS[rotateKeyboardDir(key.dir, "counterclockwise")];
        const style: KeyboardCompassKeyStyle = animateRotationHint
          ? {
              "--control-from-left": defaultPosition.left,
              "--control-from-top": defaultPosition.top,
              "--control-to-left": rotatedPosition.left,
              "--control-to-top": rotatedPosition.top,
              "--control-delay": key.delay,
            }
          : position;

        return (
          <div
            key={key.key}
            className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[0.55rem] border-2 text-lg font-black leading-none shadow-[0_4px_0_rgba(0,0,0,0.35),0_7px_14px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.24)] transition-[left,top] ${animateRotationHint ? "tutorial-control-key" : ""} ${
              key.tone === "arrow"
                ? "border-[#8b4a18] bg-[#ffe0a0] text-[#24160c]"
                : "border-yellow-200/45 bg-[#31200f]/92 text-yellow-100"
            }`}
            style={style}
          >
            {key.key}
          </div>
        );
      })}
    </div>
    <button
      type="button"
      className={`pointer-events-auto absolute left-[14.75rem] top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[0.65rem] border-2 shadow-[0_4px_0_rgba(78,39,14,0.8),0_10px_18px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.16)] transition ${animateRotationHint ? "tutorial-rotation-button" : ""} ${
        rotation === "counterclockwise"
          ? "border-[#8b4a18] bg-[linear-gradient(180deg,#ffe68a,#e88922)] text-[#3c1d07]"
          : "border-[#d8ad68]/70 bg-[linear-gradient(180deg,rgba(50,29,14,0.9),rgba(16,10,6,0.94))] text-[#ffe5b2] hover:brightness-115"
      }`}
      aria-label={rotation === "counterclockwise" ? "Вернуть обычную ориентацию клавиатуры" : "Повернуть управление на 90 градусов против часовой"}
      aria-pressed={rotation === "counterclockwise"}
      title={rotation === "counterclockwise" ? "Вернуть управление" : "Повернуть управление на 90 градусов против часовой"}
      onClick={onToggleRotation}
    >
      <RotateCcw className="h-5 w-5" aria-hidden />
    </button>
  </div>
);

const getTimerNowMs = () => performance.now();

/**
 * Avoids React state churn from tiny Pixi coordinate changes between frames.
 */
const shouldUpdatePlayerHudPosition = (
  current: { x: number; y: number } | null,
  next: { x: number; y: number },
) => {
  if (!current) return true;
  return Math.abs(current.x - next.x) > 0.5 || Math.abs(current.y - next.y) > 0.5;
};

async function copyShareUrlToClipboard(url: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard API is unavailable");
  }

  await navigator.clipboard.writeText(url);
}

function isShareAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

interface FinishedAttempt {
  id: number;
  outcome: "win" | "loss";
  levelIdx: number;
  stars?: 1 | 2 | 3;
  completedLevelsCount: number;
  didCompleteNewLevel: boolean;
}

/**
 * Owns the playable game screen, overlays, persistence, audio, and Pixi bridge.
 */
export const GameCanvas = () => {
  const t = useTranslation();
  const language = useLanguage();
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PixiGame | null>(null);
  const audioRef = useRef<ReturnType<typeof createGameAudio> | null>(null);
  const levelIdxRef = useRef(0);
  const progressRef = useRef<PlayerProgress | null>(null);
  const attemptIdRef = useRef(0);
  const isInterstitialActiveRef = useRef(false);
  const lastInterstitialRequestAtRef = useRef<number | null>(null);
  const timerStartMsRef = useRef<number | null>(null);
  const timerElapsedMsRef = useRef(0);
  const timerIntervalRef = useRef<number | null>(null);
  const hasAttemptTimerStartedRef = useRef(false);
  const attemptOutcomeRef = useRef<"playing" | "win" | "loss">("playing");
  const leaderboardRequestIdRef = useRef(0);
  const lastSubmittedLeaderboardScoreRef = useRef(0);
  const [hops, setHops] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("playing");
  const [pendingChapterTransition, setPendingChapterTransition] = useState<ChapterTransition | null>(null);
  const [levelIdx, setLevelIdx] = useState(0);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [finishedAttempt, setFinishedAttempt] = useState<FinishedAttempt | null>(null);
  const [isLevelSelectOpen, setLevelSelectOpen] = useState(false);
  const [isLeaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardStatus, setLeaderboardStatus] = useState<LeaderboardStatus>("idle");
  const [leaderboardSaveStatus, setLeaderboardSaveStatus] = useState<LeaderboardSaveStatus>("idle");
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardRow[]>([]);
  const [leaderboardUserRank, setLeaderboardUserRank] = useState<number | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareUrl, setShareUrl] = useState("");
  const [isInterstitialActive, setInterstitialActive] = useState(false);
  const [rewardedExtraMoves, setRewardedExtraMoves] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [cloudSaveState, setCloudSaveState] = useState<CloudSaveState>("checking");
  const [rewardedUndoState, setRewardedUndoState] = useState<"idle" | "loading" | "error">("idle");
  const [isDocumentVisible, setDocumentVisible] = useState(() => document.visibilityState !== "hidden");
  const [isFirstSceneRenderable, setFirstSceneRenderable] = useState(false);
  const [isStartScreenOpen, setStartScreenOpen] = useState(true);
  const [keyboardRotation, setKeyboardRotation] = useState<KeyboardRotation>("default");
  const [playerHudPosition, setPlayerHudPosition] = useState<{ x: number; y: number } | null>(null);
  const lastGameplayActiveRef = useRef<boolean | null>(null);

  const currentLevel = levels[levelIdx];
  const optimal = computeOptimalMoves(currentLevel);
  const limit = moveLimit(currentLevel) + rewardedExtraMoves;
  const progressReady = progress !== null;
  const isStartScreenBlocking = isStartScreenOpen;

  if (!audioRef.current) {
    audioRef.current = createGameAudio();
  }

  const persistProgress = (nextProgress: PlayerProgress) => {
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    setSaveState("saving");
    savePlayerProgress(nextProgress)
      .then(() => setSaveState("idle"))
      .catch((error) => {
        console.warn("[progress] failed to save player progress", error);
        setSaveState("error");
      });
  };

  const authorizeCloudSave = async () => {
    setCloudSaveState("syncing");

    try {
      const authorized = await ysdkRequestAuthorization();
      if (!authorized) {
        setCloudSaveState("guest");
        return;
      }

      const guestProgress = progressRef.current ?? createDefaultProgress();
      const syncedProgress = await migrateGuestProgressToCloud(guestProgress, levels.length);
      progressRef.current = syncedProgress;
      setProgress(syncedProgress);
      setCloudSaveState("ready");
    } catch (error) {
      console.warn("[progress] failed to authorize cloud saves", error);
      setCloudSaveState("error");
    }
  };

  const clearTimerInterval = useCallback(() => {
    if (timerIntervalRef.current === null) return;
    window.clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
  }, []);

  const updateAttemptTimer = useCallback(() => {
    const startMs = timerStartMsRef.current;
    if (startMs === null) return timerElapsedMsRef.current;

    const nextElapsedMs = timerElapsedMsRef.current + Math.max(0, getTimerNowMs() - startMs);
    setElapsedMs(nextElapsedMs);
    return nextElapsedMs;
  }, []);

  const startAttemptTimer = useCallback(() => {
    if (timerStartMsRef.current !== null) return;

    hasAttemptTimerStartedRef.current = true;
    timerStartMsRef.current = getTimerNowMs();
    setElapsedMs(timerElapsedMsRef.current);

    if (timerIntervalRef.current === null) {
      timerIntervalRef.current = window.setInterval(updateAttemptTimer, 100);
    }
  }, [updateAttemptTimer]);

  const stopAttemptTimer = useCallback(() => {
    const finalElapsedMs = updateAttemptTimer();
    timerElapsedMsRef.current = finalElapsedMs;
    timerStartMsRef.current = null;
    clearTimerInterval();
    setElapsedMs(finalElapsedMs);
    return finalElapsedMs;
  }, [clearTimerInterval, updateAttemptTimer]);

  const pauseAttemptTimer = useCallback(() => {
    if (timerStartMsRef.current === null) return;

    const pausedElapsedMs = updateAttemptTimer();
    timerElapsedMsRef.current = pausedElapsedMs;
    timerStartMsRef.current = null;
    clearTimerInterval();
    setElapsedMs(pausedElapsedMs);
  }, [clearTimerInterval, updateAttemptTimer]);

  const resumeAttemptTimer = useCallback(() => {
    if (!hasAttemptTimerStartedRef.current) return;
    startAttemptTimer();
  }, [startAttemptTimer]);

  const resetAttemptTimer = useCallback(() => {
    clearTimerInterval();
    timerStartMsRef.current = null;
    timerElapsedMsRef.current = 0;
    hasAttemptTimerStartedRef.current = false;
    setElapsedMs(0);
  }, [clearTimerInterval]);

  useEffect(() => {
    levelIdxRef.current = levelIdx;
  }, [levelIdx]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    let active = true;

    ysdkIsPlayerAuthorized()
      .then((authorized) => {
        if (active) setCloudSaveState(authorized ? "ready" : "guest");
      })
      .catch((error) => {
        console.warn("[progress] failed to read Yandex authorization state", error);
        if (active) setCloudSaveState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const showInterstitial = useCallback(async (reason: InterstitialTrigger) => {
    if (reason === "none" || isInterstitialActiveRef.current) return;

    const requestedAt = Date.now();
    if (!canRequestInterstitial(lastInterstitialRequestAtRef.current, requestedAt)) return;
    lastInterstitialRequestAtRef.current = requestedAt;
    isInterstitialActiveRef.current = true;
    setInterstitialActive(true);

    try {
      await ysdkShowAd();
    } catch (error) {
      console.warn("[ads] failed to show interstitial", error);
    } finally {
      isInterstitialActiveRef.current = false;
      setInterstitialActive(false);
    }
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    const requestId = ++leaderboardRequestIdRef.current;
    setLeaderboardStatus("loading");

    try {
      const snapshot = await loadLeaderboardSnapshot();
      if (leaderboardRequestIdRef.current !== requestId) return;
      setLeaderboardEntries(snapshot.entries);
      setLeaderboardUserRank(snapshot.userRank);
      setLeaderboardStatus("ready");
    } catch (error) {
      console.warn("[leaderboard] failed to load entries", error);
      if (leaderboardRequestIdRef.current !== requestId) return;
      setLeaderboardStatus("error");
    }
  }, []);

  const syncLeaderboardResult = useCallback(async (sourceProgress: PlayerProgress, options?: { requestAuthorization?: boolean }) => {
    const score = calculateLeaderboardScore(sourceProgress);
    if (score <= 0) {
      setLeaderboardSaveStatus("skipped");
      return;
    }
    if (!options?.requestAuthorization && score <= lastSubmittedLeaderboardScoreRef.current) {
      setLeaderboardSaveStatus("saved");
      return;
    }

    setLeaderboardSaveStatus("saving");
    try {
      const result = await saveLeaderboardScore(sourceProgress, levels.length, options);
      if (result.status === "saved") {
        lastSubmittedLeaderboardScoreRef.current = Math.max(lastSubmittedLeaderboardScoreRef.current, result.score);
      }
      setLeaderboardSaveStatus(result.status === "saved" ? "saved" : "skipped");
    } catch (error) {
      console.warn("[leaderboard] failed to save score", error);
      setLeaderboardSaveStatus("error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadPlayerProgress(levels.length).then((loadedProgress) => {
      if (cancelled) return;
      const initialLevelIdx = Math.min(levels.length - 1, Math.max(0, loadedProgress.unlockedLevel - 1));
      levelIdxRef.current = initialLevelIdx;
      progressRef.current = loadedProgress;
      setLevelIdx(initialLevelIdx);
      setProgress(loadedProgress);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setDocumentVisible(document.visibilityState !== "hidden");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.setEnvironmentHold("hidden", document.visibilityState !== "visible");

    const handleVisibilityChange = () => {
      audio.setEnvironmentHold("hidden", document.visibilityState !== "visible");
    };
    const unsubscribeFullscreenAds = subscribeToFullscreenAds((active) => {
      audio.setEnvironmentHold("ad", active);
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribeFullscreenAds();
      void audio.destroy();
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setMuted(progress?.audioMuted ?? false);
  }, [progress?.audioMuted]);

  useEffect(() => {
    return () => {
      clearTimerInterval();
    };
  }, [clearTimerInterval]);

  useEffect(() => {
    if (!progressReady) return;
    if (!hostRef.current) return;
    const game = new PixiGame(hostRef.current, currentLevel, {
      onHopCount: setHops,
      onHop: () => {
        startAttemptTimer();
        const activeLevel = levels[levelIdxRef.current];
        audioRef.current?.playHop(activeLevel ? getLevelTheme(activeLevel) : "default");
      },
      onPaint: () => audioRef.current?.playPaint(),
      onWin: (winningHops) => {
        if (attemptOutcomeRef.current !== "playing") return;
        attemptOutcomeRef.current = "win";

        const completionTimeMs = stopAttemptTimer();
        const wonLevelIdx = levelIdxRef.current;
        const wonLevel = levels[wonLevelIdx];
        const wonStars = computeStars(winningHops, wonLevel);
        if (wonStars === 3) {
          audioRef.current?.playPerfectWin();
        } else {
          audioRef.current?.playWin();
        }
        const baseProgress = progressRef.current ?? createDefaultProgress();
        const wonLevelNumber = wonLevelIdx + 1;
        const didCompleteNewLevel = !baseProgress.completedLevels.includes(wonLevelNumber);
        const nextProgress = completeLevel(baseProgress, wonLevelIdx, wonStars, levels.length, completionTimeMs);
        persistProgress(nextProgress);
        if (LEADERBOARDS_ENABLED && calculateLeaderboardScore(nextProgress) > calculateLeaderboardScore(baseProgress)) {
          void syncLeaderboardResult(nextProgress);
        }
        setFinishedAttempt({
          id: ++attemptIdRef.current,
          outcome: "win",
          levelIdx: wonLevelIdx,
          stars: wonStars,
          completedLevelsCount: nextProgress.completedLevels.length,
          didCompleteNewLevel,
        });
        setPendingChapterTransition(getChapterTransition(levels, wonLevelIdx));
        setOverlayMode("won");
      },
      onLose: () => {
        if (attemptOutcomeRef.current !== "playing") return;
        attemptOutcomeRef.current = "loss";

        audioRef.current?.playLoss();
        stopAttemptTimer();
        const lostLevelIdx = levelIdxRef.current;
        const baseProgress = progressRef.current ?? createDefaultProgress();
        setPendingChapterTransition(null);
        setRewardedUndoState("idle");
        setFinishedAttempt({
          id: ++attemptIdRef.current,
          outcome: "loss",
          levelIdx: lostLevelIdx,
          completedLevelsCount: baseProgress.completedLevels.length,
          didCompleteNewLevel: false,
        });
        setOverlayMode("lost");
      },
      onPlayerScreenPosition: (position) => {
        const nextPosition = {
          x: Math.round(position.x * 10) / 10,
          y: Math.round(position.y * 10) / 10,
        };
        setPlayerHudPosition((current) => (
          shouldUpdatePlayerHudPosition(current, nextPosition) ? nextPosition : current
        ));
      },
    }, {
      keyboardRotation,
      onFirstSceneRenderable: () => {
        setFirstSceneRenderable(true);
        ysdkReady().catch(() => {});
      },
    });
    game.setMoveLimit(limit);
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressReady]);

  // При смене уровня — обновляем игру
  useEffect(() => {
    if (!progressReady) return;
    if (!gameRef.current) return;
    attemptOutcomeRef.current = "playing";
    gameRef.current.setLevel(currentLevel);
    gameRef.current.setMoveLimit(moveLimit(currentLevel));
    setRewardedExtraMoves(0);
    setFinishedAttempt(null);
    setRewardedUndoState("idle");
    setPlayerHudPosition(null);
    resetAttemptTimer();
    setHops(0);
  }, [levelIdx, currentLevel, progressReady, resetAttemptTimer]);

  useEffect(() => {
    gameRef.current?.setKeyboardRotation(keyboardRotation);
  }, [keyboardRotation]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;

    if (isStartScreenBlocking || overlayMode !== "playing" || isLevelSelectOpen || isLeaderboardOpen) {
      game.pause();
      pauseAttemptTimer();
      return;
    }

    game.resume();
    resumeAttemptTimer();
  }, [isStartScreenBlocking, overlayMode, isLevelSelectOpen, isLeaderboardOpen, pauseAttemptTimer, resumeAttemptTimer]);

  const loadLevel = (nextLevelIdx: number) => {
    attemptOutcomeRef.current = "playing";
    if (nextLevelIdx === levelIdx) {
      gameRef.current?.setLevel(levels[nextLevelIdx]);
      gameRef.current?.setMoveLimit(moveLimit(levels[nextLevelIdx]));
      setRewardedExtraMoves(0);
      resetAttemptTimer();
      setHops(0);
    }
    setLevelIdx(nextLevelIdx);
  };

  const resumeGameplay = () => {
    setLevelSelectOpen(false);
    setOverlayMode("playing");
  };

  const resetCurrentAttempt = () => {
    setRewardedExtraMoves(0);
    attemptOutcomeRef.current = "playing";
    setFinishedAttempt(null);
    gameRef.current?.reset();
    gameRef.current?.setMoveLimit(moveLimit(currentLevel));
    setPendingChapterTransition(null);
    setRewardedUndoState("idle");
    resetAttemptTimer();
    resumeGameplay();
    setHops(0);
  };

  const restart = () => {
    if (isInterstitialActiveRef.current) return;
    void (async () => {
      await showInterstitial("restart");
      resetCurrentAttempt();
    })();
  };

  const openLevelSelect = () => {
    if (isInterstitialActiveRef.current) return;
    void (async () => {
      if (overlayMode === "lost") {
        await showInterstitial("after-loss");
      }
      setLevelSelectOpen(true);
    })();
  };

  const closeLevelSelect = () => {
    setLevelSelectOpen(false);
  };

  const openLeaderboard = () => {
    if (!LEADERBOARDS_ENABLED) return;
    setLeaderboardOpen(true);
    const baseProgress = progressRef.current;

    void (async () => {
      if (baseProgress && calculateLeaderboardScore(baseProgress) > 0) {
        await syncLeaderboardResult(baseProgress);
      }
      await refreshLeaderboard();
    })();
  };

  const closeLeaderboard = () => {
    setLeaderboardOpen(false);
  };

  const saveLeaderboardResult = () => {
    const baseProgress = progressRef.current;
    if (!baseProgress) return;

    void (async () => {
      await syncLeaderboardResult(baseProgress, { requestAuthorization: true });
      await refreshLeaderboard();
    })();
  };

  const selectLevel = (nextLevelIdx: number) => {
    if (isInterstitialActiveRef.current) return;
    if (!progress || !isLevelUnlocked(progress, nextLevelIdx)) return;
    setFinishedAttempt(null);
    setPendingChapterTransition(null);
    setRewardedUndoState("idle");
    resumeGameplay();
    loadLevel(nextLevelIdx);
  };

  const markTutorialComplete = () => {
    const baseProgress = progressRef.current;
    if (!baseProgress) return;
    persistProgress(completeTutorial(baseProgress, levels.length));
  };

  const toggleMute = () => {
    const baseProgress = progressRef.current;
    if (!baseProgress) return;
    persistProgress(setAudioMuted(baseProgress, !baseProgress.audioMuted, levels.length));
  };

  const startFromStartScreen = () => {
    const baseProgress = progressRef.current;
    if (!baseProgress) return;

    if (!baseProgress.hasStarted) {
      persistProgress(markGameStarted(baseProgress, levels.length));
    }

    setStartScreenOpen(false);
  };

  const openPauseMenu = () => {
    if (overlayMode === "playing") {
      setOverlayMode("paused");
    }
  };

  const triggerRewardedExtraMoves = async () => {
    const game = gameRef.current;
    if (!game || rewardedUndoState === "loading" || overlayMode !== "lost") return;

    setRewardedUndoState("loading");

    const result = await ysdkShowRewardedAd();
    const nextLimit = limit + REWARDED_EXTRA_MOVES;
    if (result.status === "rewarded" && game.continueAfterLoss(nextLimit)) {
      setRewardedExtraMoves((current) => current + REWARDED_EXTRA_MOVES);
      attemptOutcomeRef.current = "playing";
      setFinishedAttempt(null);
      setRewardedUndoState("idle");
      setOverlayMode("playing");
      startAttemptTimer();
      return;
    }

    setRewardedUndoState("error");
  };

  const continueAfterWin = () => {
    if (isInterstitialActiveRef.current || !progress) return;
    const nextLevelIdx = levelIdx + 1;

    const continueFlow = async () => {
      await showInterstitial("after-win");

      if (nextLevelIdx >= levels.length) {
        setPendingChapterTransition(null);
        setOverlayMode("final");
        return;
      }

      if (pendingChapterTransition) {
        loadLevel(pendingChapterTransition.nextLevelIndex);
        setOverlayMode("chapter");
        return;
      }

      if (isLevelUnlocked(progress, nextLevelIdx)) {
        resumeGameplay();
        loadLevel(nextLevelIdx);
      }
    };

    void continueFlow();
  };

  const startChapterLevel = () => {
    setPendingChapterTransition(null);
    resumeGameplay();
  };

  const stars = overlayMode === "won" ? (finishedAttempt?.stars ?? computeStars(hops, currentLevel)) : 0;
  const isPerfectWin = overlayMode === "won" && stars === 3;
  const bestStars = progress ? getBestStars(progress, levelIdx) : 0;
  const bestTimeMs = progress ? getBestTimeMs(progress, levelIdx) : null;
  const formattedElapsedTime = formatDurationMs(elapsedMs);
  const formattedBestTime = bestTimeMs === null ? null : formatDurationMs(bestTimeMs);
  const totalStars = progress ? getTotalStars(progress) : 0;
  const maxStars = levels.length * 3;
  const totalRaces = progress ? getTotalRaces(progress, levels.length) : 0;
  const maxRaces = getMaxRaces(levels.length);
  const raceTimeLimitMs = getRaceTimeLimitMs(levelIdx);
  const formattedRaceTarget = raceTimeLimitMs === null ? null : formatDurationMs(raceTimeLimitMs);
  const hasCurrentRaceAward = progress ? hasRaceAward(progress, levelIdx) : false;
  const currentLeaderboardScore = progress ? calculateLeaderboardScore(progress) : 0;
  const isInteractionLocked = isStartScreenBlocking || isInterstitialActive;
  const canShowRewardedExtraMoves = overlayMode === "lost";
  const isTutorialBlocking = levelIdx === 0 && progress !== null && !progress.tutorialComplete;
  const isGameplayActive = progressReady
    && isFirstSceneRenderable
    && !isStartScreenBlocking
    && overlayMode === "playing"
    && !isLevelSelectOpen
    && !isLeaderboardOpen
    && !isTutorialBlocking
    && isDocumentVisible;
  const bgTheme: BgTheme = (currentLevel.theme as BgTheme) ?? "default";
  const currentChapter = getChapterForLevel(chapters, levelIdx);
  const shouldShowKeyboardCompass = overlayMode === "playing" && !isLevelSelectOpen && !isLeaderboardOpen && !isInteractionLocked && isFirstSceneRenderable && !isStartScreenBlocking;
  const shouldAnimateKeyboardCompassTutorial = shouldShowKeyboardCompass && isTutorialBlocking && hops < 1;
  const shouldShowMobileJoystick =
    overlayMode === "playing" && !isLevelSelectOpen && !isLeaderboardOpen && !isInteractionLocked && isFirstSceneRenderable && !isStartScreenBlocking;
  const toggleKeyboardRotation = () => {
    setKeyboardRotation((current) => current === "default" ? "counterclockwise" : "default");
  };
  const pauseButtonLabel = overlayMode === "paused" ? t("continue") : t("pause");
  const currentLevelName = getLevelName(currentLevel.name, language);
  const shareStatusLabel =
    shareStatus === "copied"
      ? t("copied")
      : shareStatus === "shared"
        ? t("shared")
        : shareStatus === "error"
          ? t("shareError")
          : "";

  const getShareContext = (): SharedResultContext => {
    if (overlayMode === "won" && finishedAttempt?.outcome === "win") {
      const resultStars = stars === 1 || stars === 2 || stars === 3 ? stars : 1;

      return {
        kind: "level",
        levelNumber: levelIdx + 1,
        levelName: currentLevelName,
        stars: resultStars,
        hops,
        optimalMoves: optimal,
        timeMs: elapsedMs > 0 ? Math.trunc(elapsedMs) : null,
      };
    }

    if (overlayMode === "final") {
      return { kind: "final" };
    }

    return { kind: "progress" };
  };

  const shareCurrentResult = async () => {
    const baseProgress = progressRef.current ?? progress;
    if (!baseProgress) return;

    const sharedResult = createSharedResult(baseProgress, levels.length, getShareContext());
    const nextShareUrl = buildSharedResultUrl(sharedResult);
    setShareUrl(nextShareUrl);
    setShareStatus("idle");

    try {
      if (navigator.share) {
        await navigator.share({
          title: t("shareTitle"),
          text: t("shareMessage"),
          url: nextShareUrl,
        });
        setShareStatus("shared");
        return;
      }
    } catch (error) {
      if (isShareAbortError(error)) return;
    }

    try {
      await copyShareUrlToClipboard(nextShareUrl);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    }
  };

  const shareResultControls = (
    <div className="flex flex-col gap-2">
      <Button onClick={shareCurrentResult} disabled={isInteractionLocked} variant="secondary" className="w-full">
        {shareStatus === "copied" || shareStatus === "shared" ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Share2 className="h-4 w-4" aria-hidden />
        )}
        {t("shareResult")}
      </Button>
      {shareStatusLabel && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            shareStatus === "error"
              ? "border-red-200/25 bg-red-400/10 text-red-100"
              : "border-white/10 bg-white/[0.06] text-white/70"
          }`}
        >
          <span>{shareStatusLabel}</span>
          {shareUrl && (
            <a href={shareUrl} target="_blank" rel="noreferrer" className="ml-2 font-bold text-white underline underline-offset-2">
              {t("openResult")}
            </a>
          )}
        </div>
      )}
    </div>
  );

  useEffect(() => {
    setShareStatus("idle");
    setShareUrl("");
  }, [levelIdx, overlayMode]);

  useEffect(() => {
    if (lastGameplayActiveRef.current === isGameplayActive) return;
    lastGameplayActiveRef.current = isGameplayActive;
    const syncPromise = isGameplayActive ? ysdkGameplayStart() : ysdkGameplayStop();
    syncPromise.catch(() => {});
  }, [isGameplayActive]);

  useEffect(() => {
    return () => {
      ysdkGameplayStop().catch(() => {});
    };
  }, []);

  if (!progress) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <StartScreen
          isLoading
          isFirstStart
          currentLevelNumber={1}
          totalStars={0}
          maxStars={levels.length * 3}
          totalRaces={0}
          maxRaces={getMaxRaces(levels.length)}
          cloudSaveState={cloudSaveState}
          onStart={() => {}}
          onAuthorizeCloudSave={() => void authorizeCloudSave()}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden touch-none select-none">
      <ParallaxBackground theme={bgTheme} />
      <div ref={hostRef} className="absolute inset-0" />

      {/* Интерактивный туториал — только для первого уровня и пока игрок не пройдёт его */}
      {overlayMode === "playing" && !isLevelSelectOpen && !isStartScreenBlocking && (
        <TutorialOverlay
          levelIdx={levelIdx}
          hops={hops}
          tutorialComplete={progress.tutorialComplete}
          onComplete={markTutorialComplete}
        />
      )}


      {/* HUD */}
      <header className="absolute left-0 right-0 top-0 px-2 py-2 pr-[4rem] pointer-events-none sm:px-4 sm:py-3 sm:pr-[4.75rem]">
        <div className="flex items-start justify-between gap-2">
          <div className="pointer-events-auto flex min-w-0 flex-col items-start gap-3">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <h1 className="game-title truncate text-lg sm:text-2xl">
                {t("gameTitle")}
              </h1>
              <span className="game-hud-text hidden truncate sm:inline">
                · {currentLevelName}
              </span>
            </div>
            {currentChapter && (
              <div className="game-hud-text whitespace-nowrap">
                {t("chapter")} {currentChapter.chapterIndex} · {getThemeLabel(currentChapter.theme, language)}
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={openLevelSelect}
                disabled={isInteractionLocked}
                className="game-hud-action justify-start"
              >
                <Map className="h-4 w-4 shrink-0" aria-hidden />
                {t("level")} {levelIdx + 1} / {levels.length}
              </Button>
              <div
                className="game-hud-chip game-hud-ideal-pill px-2 py-1 text-xs font-black tabular-nums whitespace-nowrap sm:text-sm"
                title={t("idealMoves")}
                data-tutorial-highlight="goal"
              >
                ★ {optimal}
              </div>
              {LEADERBOARDS_ENABLED && <Button
                size="sm"
                variant="ghost"
                onClick={openLeaderboard}
                disabled={isInteractionLocked}
                className="game-hud-action game-hud-action-cyan"
                title={t("leaders")}
                aria-label={t("leaders")}
              >
                <Trophy className="h-4 w-4" aria-hidden />
              </Button>}
            </div>
          </div>
        </div>

        <div className="game-timer-cluster pointer-events-auto absolute top-2 flex flex-col items-center gap-1.5 sm:top-3">
          <div
            className="game-hud-chip game-hud-timer flex items-center gap-1 px-2 py-1 text-xs font-black tabular-nums whitespace-nowrap sm:text-sm"
            title={t("attemptTime")}
          >
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            {formattedElapsedTime}
          </div>
          {(formattedBestTime || formattedRaceTarget) && (
            <div className="game-hud-subpanel">
              {formattedBestTime && <div>{t("best")}: {formattedBestTime}</div>}
              {formattedRaceTarget && (
                <div className={formattedBestTime ? "mt-1" : ""}>
                  {hasCurrentRaceAward ? t("raceEarned") : t("raceTarget", { time: formattedRaceTarget })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pointer-events-auto absolute right-2 top-2 flex flex-col items-end gap-2 sm:right-4 sm:top-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={overlayMode === "paused" ? resumeGameplay : openPauseMenu}
            className="game-hud-action game-hud-action-stack"
            title={pauseButtonLabel}
            aria-label={pauseButtonLabel}
          >
            {overlayMode === "paused" ? <Play className="h-4 w-4 shrink-0" aria-hidden /> : <Pause className="h-4 w-4 shrink-0" aria-hidden />}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={toggleMute}
            className="game-hud-action game-hud-action-stack"
            title={progress.audioMuted ? t("unmute") : t("mute")}
            aria-label={progress.audioMuted ? t("unmute") : t("mute")}
            aria-pressed={progress.audioMuted}
          >
            {progress.audioMuted ? <VolumeX className="h-4 w-4 shrink-0" aria-hidden /> : <Volume2 className="h-4 w-4 shrink-0" aria-hidden />}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={restart}
            disabled={isInteractionLocked}
            className="game-hud-action game-hud-action-stack"
            title={t("restart")}
            aria-label={t("restart")}
          >
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </div>

        {/* Прогресс — отдельной строкой под HUD */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
          {saveState !== "idle" && (
            <div className="game-hud-text hidden whitespace-nowrap sm:block">
              {saveState === "saving" ? t("save") : t("notSaved")}
            </div>
          )}
        </div>
      </header>

      {shouldShowKeyboardCompass && (
        <KeyboardCompassControl
          rotation={keyboardRotation}
          onToggleRotation={toggleKeyboardRotation}
          animateRotationHint={shouldAnimateKeyboardCompassTutorial}
        />
      )}

      {overlayMode === "playing" && playerHudPosition && !isLevelSelectOpen && !isLeaderboardOpen && !isStartScreenBlocking && (
        <div
          className="game-floating-moves pointer-events-none absolute z-30 select-none tabular-nums"
          style={{
            left: `${playerHudPosition.x}px`,
            top: `${playerHudPosition.y}px`,
            transform: "translate(-50%, -100%)",
          }}
          aria-hidden
        >
          {Math.max(0, limit - hops)}
        </div>
      )}

      {shouldShowMobileJoystick && (
        <MobileJoystick onDirection={(dir) => gameRef.current?.triggerDir(dir)} />
      )}

      {/* Оверлеи */}
      {overlayMode !== "playing" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#120804]/70 px-4 backdrop-blur-[2px]">
          <div className={`game-panel relative w-full max-w-sm overflow-hidden p-5 text-center text-white sm:p-6 ${isPerfectWin ? "perfect-win-panel" : ""}`}>
            {overlayMode === "won" && (
              <div className="relative z-10">
                {isPerfectWin && <PerfectCelebration />}
                <h2 className="game-title text-2xl">{t("win")}</h2>
                {isPerfectWin && (
                  <div className="perfect-win-badge game-hud-text mx-auto mt-3 inline-flex items-center gap-1.5 uppercase text-yellow-100">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    {t("perfect")}
                  </div>
                )}
                <div className="mt-4 flex flex-col items-center gap-2">
                  <div className="flex justify-center gap-1">
                    <Star filled={stars >= 1} perfectIndex={isPerfectWin ? 0 : undefined} />
                    <Star filled={stars >= 2} perfectIndex={isPerfectWin ? 1 : undefined} />
                    <Star filled={stars >= 3} perfectIndex={isPerfectWin ? 2 : undefined} />
                  </div>
                  {bestStars > stars && (
                    <div className="text-xs font-medium text-white/65">
                      {t("bestResult")}: {bestStars} ★
                    </div>
                  )}
                </div>
                <p className="mt-4 text-sm text-white/75">
                  {t("moves")}: {hops} · {t("ideal")}: {optimal}
                </p>
                <p className="mt-2 text-sm text-white/75">
                  {t("time")}: {formattedElapsedTime}
                  {formattedBestTime ? ` · ${t("best").toLowerCase()}: ${formattedBestTime}` : ""}
                </p>
                {formattedRaceTarget && (
                  <div
                    className={`game-hud-text mx-auto mt-3 inline-flex items-center gap-1.5 ${hasCurrentRaceAward ? "text-cyan-100" : "text-white/78"}`}
                  >
                    <CarFront className="h-3.5 w-3.5 text-cyan-200" aria-hidden />
                    {hasCurrentRaceAward ? t("raceEarned") : t("raceTarget", { time: formattedRaceTarget })}
                  </div>
                )}
                <div className="mt-5 flex flex-col gap-2">
                  <Button onClick={continueAfterWin} disabled={isInteractionLocked} className="w-full">
                    {levelIdx === levels.length - 1
                      ? t("finalScreen")
                      : pendingChapterTransition
                        ? t("openChapter", { chapter: pendingChapterTransition.toChapter.chapterIndex })
                        : t("nextLevel")}
                  </Button>
                  {shareResultControls}
                  <Button onClick={restart} disabled={isInteractionLocked} variant="secondary" className="w-full">
                    {t("playAgain")}
                  </Button>
                </div>
              </div>
            )}

            {overlayMode === "lost" && (
              <>
                <h2 className="game-title text-2xl">{t("outOfMoves")}</h2>
                <p className="mt-3 text-sm text-white/75">
                  {t("outOfMovesBody")} {limit}.
                </p>
                <p className="mt-2 text-sm text-white/65">
                  {t("attemptTime")}: {formattedElapsedTime}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {canShowRewardedExtraMoves && (
                    <Button onClick={triggerRewardedExtraMoves} disabled={rewardedUndoState === "loading"} className="w-full">
                      {rewardedUndoState === "loading" ? t("rewardLoading") : t("rewardUndo")}
                    </Button>
                  )}
                  <Button onClick={restart} disabled={isInteractionLocked} className="w-full">
                    {t("restartLevel")}
                  </Button>
                  <Button onClick={openLevelSelect} disabled={isInteractionLocked} variant="secondary" className="w-full">
                    {t("levelsMenu")}
                  </Button>
                </div>
                {rewardedUndoState === "error" && (
                  <p className="mt-3 text-xs text-white/65">
                    {t("rewardError")}
                  </p>
                )}
              </>
            )}

            {overlayMode === "paused" && (
              <>
                <p className="text-xs font-black uppercase text-[#ffd98e]/75">
                  {t("menu")}
                </p>
                <h2 className="game-title mt-2 text-2xl">{t("pause")}</h2>
                <p className="mt-3 text-sm text-white/75">
                  {t("pausedBody")}
                </p>
                <div className="game-stat-cell mt-4 p-3 text-left">
                  <div className="flex items-center justify-between gap-2 text-xs text-white/70">
                    <span>{t("now")}</span>
                    <span>
                      {t("level")} {levelIdx + 1}
                      {currentChapter ? ` · ${t("chapter").toLowerCase()} ${currentChapter.chapterIndex}` : ""}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-white/75 sm:grid-cols-2">
                    <div className="game-stat-cell px-3 py-2">
                      <div className="font-semibold text-white">ПК</div>
                      <div className="mt-1">{t("mouseMove")}</div>
                      <div className="mt-1">{t("arrowMove")}</div>
                      <div className="mt-1">{t("keyboardMove")}</div>
                    </div>
                    <div className="game-stat-cell px-3 py-2">
                      <div className="font-semibold text-white">{t("phone")}</div>
                      <div className="mt-1">{t("touchMove")}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                    <span className="game-hud-text">{t("moves")}: {hops}/{limit}</span>
                    <span className="game-hud-text">{t("bestResult")}: {bestStars || "—"} ★</span>
                    {maxRaces > 0 && <span className="game-hud-text">{t("races")}: {totalRaces}/{maxRaces}</span>}
                    <span className="game-hud-text">{t("time")}: {formattedElapsedTime}</span>
                    <span className="game-hud-text">{t("bestTime")}: {formattedBestTime ?? "—"}</span>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <Button onClick={resumeGameplay} className="w-full">
                    <Play className="mr-2 h-4 w-4" aria-hidden />
                    {t("continue")}
                  </Button>
                  <Button onClick={restart} variant="secondary" className="w-full">
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                    {t("restart")}
                  </Button>
                  <Button onClick={openLevelSelect} variant="secondary" className="w-full">
                    <Map className="mr-2 h-4 w-4" aria-hidden />
                    {t("levelsMenu")}
                  </Button>
                </div>
              </>
            )}

            {overlayMode === "chapter" && pendingChapterTransition && (
              <>
                <div className="game-hud-chip mx-auto flex h-11 w-11 items-center justify-center rounded-full">
                  <Trophy className="h-5 w-5 text-yellow-300" aria-hidden />
                </div>
                <p className="mt-4 text-xs font-black uppercase text-[#ffd98e]/75">
                  {t("newChapter")}
                </p>
                <h2 className="game-title mt-2 text-2xl">
                  {t("chapter")} {pendingChapterTransition.toChapter.chapterIndex}
                </h2>
                <p className="mt-2 text-sm text-white/75">
                  {getThemeLabel(pendingChapterTransition.toChapter.theme, language)} · {t("levels").toLowerCase()} {pendingChapterTransition.toChapter.startLevelIndex + 1}
                  -{pendingChapterTransition.toChapter.endLevelIndex + 1}
                </p>
                <p className="mt-3 text-sm text-white/65">
                  {t("chapterPalette", { chapter: pendingChapterTransition.fromChapter.chapterIndex })}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <Button onClick={startChapterLevel} className="w-full">
                    {t("startChapter")}
                  </Button>
                  <Button onClick={openLevelSelect} variant="secondary" className="w-full">
                    {t("levelsMenu")}
                  </Button>
                </div>
              </>
            )}

            {overlayMode === "final" && (
              <>
                <div className="game-hud-chip mx-auto flex h-11 w-11 items-center justify-center rounded-full">
                  <Trophy className="h-5 w-5 text-yellow-300" aria-hidden />
                </div>
                <h2 className="game-title mt-4 text-2xl">{t("finalTitle")}</h2>
                <p className="mt-3 text-sm text-white/75">
                  {t("finalSummary", {
                    levels: levels.length,
                    stars: totalStars,
                    maxStars,
                    races: maxRaces > 0 ? ` ${t("races").toLowerCase()}: ${totalRaces}/${maxRaces}` : "",
                  })}
                </p>
                <p className="mt-2 text-sm text-white/65">
                  {t("finalBody")}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {shareResultControls}
                  <Button onClick={restart} className="w-full">
                    {t("replayFinal")}
                  </Button>
                  <Button onClick={openLevelSelect} variant="secondary" className="w-full">
                    {t("levelsMenu")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <LevelSelect
        open={isLevelSelectOpen}
        levels={levels}
        progress={progress}
        currentLevelIndex={levelIdx}
        onClose={() => {
          if (isInterstitialActiveRef.current) return;
          closeLevelSelect();
        }}
        onSelectLevel={selectLevel}
      />

      <LeaderboardPanel
        open={isLeaderboardOpen}
        currentScore={currentLeaderboardScore}
        maxScore={maxStars}
        entries={leaderboardEntries}
        userRank={leaderboardUserRank}
        status={leaderboardStatus}
        saveStatus={leaderboardSaveStatus}
        onClose={closeLeaderboard}
        onRefresh={refreshLeaderboard}
        onSave={saveLeaderboardResult}
      />

      {isStartScreenOpen && (
        <StartScreen
          isLoading={false}
          isFirstStart={!progress.hasStarted}
          currentLevelNumber={levelIdx + 1}
          totalStars={totalStars}
          maxStars={maxStars}
          totalRaces={totalRaces}
          maxRaces={maxRaces}
          cloudSaveState={cloudSaveState}
          onStart={startFromStartScreen}
          onAuthorizeCloudSave={() => void authorizeCloudSave()}
        />
      )}
    </div>
  );
};

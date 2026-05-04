import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { CarFront, Check, Clock3, Map, Pause, Play, RotateCcw, Share2, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { PixiGame } from "@/game/PixiGame";
import { createGameAudio } from "@/game/audio";
import { decideInterstitialTrigger, type InterstitialTrigger } from "@/game/interstitials";
import { levels } from "@/game/levels";
import { deriveChapters, getChapterForLevel, getChapterTransition, getLevelTheme, type ChapterTransition } from "@/game/levels/chapters";
import { computeOptimalMoves, computeStars, moveLimit } from "@/game/difficulty";
import { subscribeToFullscreenAds, ysdkGameplayStart, ysdkGameplayStop, ysdkReady, ysdkShowAd, ysdkShowRewardedAd } from "@/sdk/yandex";
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
  savePlayerProgress,
  setAudioMuted,
  type PlayerProgress,
} from "@/game/progress";
import { calculateLeaderboardScore, loadLeaderboardSnapshot, saveLeaderboardScore, type LeaderboardRow } from "@/game/leaderboard";
import { buildSharedResultUrl, createSharedResult, type SharedResultContext } from "@/game/shareResult";
import { formatDurationMs } from "@/game/time";

type OverlayMode = "playing" | "paused" | "won" | "lost" | "chapter" | "final";
type LeaderboardStatus = "idle" | "loading" | "ready" | "error";
type LeaderboardSaveStatus = "idle" | "saving" | "saved" | "error" | "skipped";
type ShareStatus = "idle" | "copied" | "shared" | "error";

const chapters = deriveChapters(levels);

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

const KeyboardCompassHint = () => (
  <div
    className="pointer-events-none absolute left-3 top-[5.2rem] z-30 hidden h-36 w-56 sm:block lg:left-4 lg:top-[5.75rem]"
    role="img"
    aria-label="Изометрическая подсказка управления: стрелки идут вверх, вправо, вниз и влево по экрану; W, D, S, A идут по диагоналям поля."
  >
    <div className="absolute inset-x-2 inset-y-1 bg-black/58 shadow-[0_18px_34px_rgba(0,0,0,0.44),inset_0_0_28px_rgba(255,255,255,0.08)] backdrop-blur-md [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
    <div className="absolute inset-x-2 inset-y-1 border border-cyan-200/35 bg-cyan-200/[0.04] [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
    <div className="absolute left-1/2 top-1/2 h-px w-[86%] -translate-x-1/2 -translate-y-1/2 rotate-[32deg] bg-cyan-200/22" />
    <div className="absolute left-1/2 top-1/2 h-px w-[86%] -translate-x-1/2 -translate-y-1/2 -rotate-[32deg] bg-cyan-200/22" />
    <div className="absolute left-1/2 top-1/2 h-px w-[82%] -translate-x-1/2 -translate-y-1/2 bg-white/14" />
    <div className="absolute left-1/2 top-1/2 h-[78%] w-px -translate-x-1/2 -translate-y-1/2 bg-white/14" />
    <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-200/70 bg-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.55)]" />
    {[
      { key: "↑", className: "left-1/2 top-[7%] -translate-x-1/2", tone: "arrow" },
      { key: "W", className: "right-[24%] top-[20%]", tone: "wasd" },
      { key: "→", className: "right-[6%] top-1/2 -translate-y-1/2", tone: "arrow" },
      { key: "D", className: "right-[24%] bottom-[20%]", tone: "wasd" },
      { key: "↓", className: "bottom-[7%] left-1/2 -translate-x-1/2", tone: "arrow" },
      { key: "S", className: "bottom-[20%] left-[24%]", tone: "wasd" },
      { key: "←", className: "left-[6%] top-1/2 -translate-y-1/2", tone: "arrow" },
      { key: "A", className: "left-[24%] top-[20%]", tone: "wasd" },
    ].map((key) => (
      <div
        key={key.key}
        className={`absolute flex h-8 w-8 items-center justify-center rounded-md border text-lg font-black leading-none shadow-[0_7px_14px_rgba(0,0,0,0.4),inset_0_-2px_0_rgba(0,0,0,0.2)] ${
          key.tone === "arrow"
            ? "border-white/25 bg-white/90 text-[#24160c]"
            : "border-yellow-200/45 bg-[#31200f]/92 text-yellow-100"
        } ${key.className}`}
      >
        {key.key}
      </div>
    ))}
  </div>
);

const getNextLevelContext = (fromLevelIdx: number) => {
  const nextLevelIdx = fromLevelIdx + 1;
  if (nextLevelIdx >= levels.length) {
    return { nextLevelIdx: null, nextLevel: null };
  }

  return { nextLevelIdx, nextLevel: levels[nextLevelIdx] };
};

const getTimerNowMs = () => performance.now();

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

export const GameCanvas = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PixiGame | null>(null);
  const audioRef = useRef<ReturnType<typeof createGameAudio> | null>(null);
  const levelIdxRef = useRef(0);
  const progressRef = useRef<PlayerProgress | null>(null);
  const attemptIdRef = useRef(0);
  const isInterstitialActiveRef = useRef(false);
  const handledInterstitialAttemptRef = useRef<number | null>(null);
  const timerStartMsRef = useRef<number | null>(null);
  const timerElapsedMsRef = useRef(0);
  const timerIntervalRef = useRef<number | null>(null);
  const hasAttemptTimerStartedRef = useRef(false);
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [rewardedUndoState, setRewardedUndoState] = useState<"idle" | "loading" | "error">("idle");
  const [isDocumentVisible, setDocumentVisible] = useState(() => document.visibilityState !== "hidden");
  const [isFirstSceneRenderable, setFirstSceneRenderable] = useState(false);
  const [isStartScreenOpen, setStartScreenOpen] = useState(true);
  const lastGameplayActiveRef = useRef<boolean | null>(null);

  const currentLevel = levels[levelIdx];
  const optimal = computeOptimalMoves(currentLevel);
  const limit = moveLimit(currentLevel);
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

  const showInterstitial = useCallback(async (reason: InterstitialTrigger) => {
    if (reason === "none" || isInterstitialActiveRef.current) return;

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
        if (calculateLeaderboardScore(nextProgress) > calculateLeaderboardScore(baseProgress)) {
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
    }, {
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
    gameRef.current.setLevel(currentLevel);
    gameRef.current.setMoveLimit(limit);
    handledInterstitialAttemptRef.current = null;
    setFinishedAttempt(null);
    setRewardedUndoState("idle");
    resetAttemptTimer();
    setHops(0);
  }, [levelIdx, currentLevel, limit, progressReady, resetAttemptTimer]);

  useEffect(() => {
    if (overlayMode === "playing") {
      handledInterstitialAttemptRef.current = null;
      return;
    }

    if (!finishedAttempt) return;
    if (handledInterstitialAttemptRef.current === finishedAttempt.id) return;
    handledInterstitialAttemptRef.current = finishedAttempt.id;

    const { nextLevelIdx, nextLevel } = getNextLevelContext(finishedAttempt.levelIdx);
    const reason = decideInterstitialTrigger({
      outcome: finishedAttempt.outcome,
      completedLevelsCount: finishedAttempt.completedLevelsCount,
      didCompleteNewLevel: finishedAttempt.didCompleteNewLevel,
      currentLevelIndex: finishedAttempt.levelIdx,
      nextLevelIndex: nextLevelIdx,
      currentTheme: levels[finishedAttempt.levelIdx]?.theme,
      nextTheme: nextLevel?.theme,
    });

    if (reason === "after-loss" || reason === "periodic-win") {
      void showInterstitial(reason);
    }
  }, [finishedAttempt, overlayMode, showInterstitial]);

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
    if (nextLevelIdx === levelIdx) {
      gameRef.current?.setLevel(levels[nextLevelIdx]);
      gameRef.current?.setMoveLimit(moveLimit(levels[nextLevelIdx]));
      resetAttemptTimer();
      setHops(0);
    }
    setLevelIdx(nextLevelIdx);
  };

  const resumeGameplay = () => {
    setLevelSelectOpen(false);
    setOverlayMode("playing");
  };

  const restart = () => {
    if (isInterstitialActiveRef.current) return;
    setFinishedAttempt(null);
    gameRef.current?.reset();
    setPendingChapterTransition(null);
    setRewardedUndoState("idle");
    resetAttemptTimer();
    resumeGameplay();
    setHops(0);
  };

  const openLevelSelect = () => {
    setLevelSelectOpen(true);
  };

  const closeLevelSelect = () => {
    setLevelSelectOpen(false);
  };

  const openLeaderboard = () => {
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

  const triggerRewardedUndo = async () => {
    const game = gameRef.current;
    if (!game || rewardedUndoState === "loading" || !game.canUndoLastMove()) return;

    setRewardedUndoState("loading");

    const result = await ysdkShowRewardedAd();
    if (result.status === "rewarded" && game.undoLastMove()) {
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
    if (nextLevelIdx >= levels.length) {
      setPendingChapterTransition(null);
      setOverlayMode("final");
      return;
    }

    const reason = decideInterstitialTrigger({
      outcome: "win",
      completedLevelsCount: progress.completedLevels.length,
      didCompleteNewLevel: finishedAttempt?.didCompleteNewLevel ?? true,
      currentLevelIndex: levelIdx,
      nextLevelIndex: nextLevelIdx,
      currentTheme: currentLevel.theme,
      nextTheme: levels[nextLevelIdx]?.theme,
    });

    const continueFlow = async () => {
      if (reason === "chapter-boundary") {
        await showInterstitial(reason);
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
  const canPlayNext = Boolean(progress && levelIdx < levels.length - 1 && isLevelUnlocked(progress, levelIdx + 1));
  const finishedAttemptLevelContext = finishedAttempt ? getNextLevelContext(finishedAttempt.levelIdx) : null;
  const overlayInterstitialTrigger =
    overlayMode === "playing" || !finishedAttempt
      ? "none"
      : decideInterstitialTrigger({
          outcome: finishedAttempt.outcome,
          completedLevelsCount: finishedAttempt.completedLevelsCount,
          didCompleteNewLevel: finishedAttempt.didCompleteNewLevel,
          currentLevelIndex: finishedAttempt.levelIdx,
          nextLevelIndex: finishedAttemptLevelContext?.nextLevelIdx ?? null,
          currentTheme: levels[finishedAttempt.levelIdx]?.theme,
          nextTheme: finishedAttemptLevelContext?.nextLevel?.theme,
        });
  const isAutoInterstitialTrigger =
    overlayInterstitialTrigger === "after-loss" || overlayInterstitialTrigger === "periodic-win";
  const hasHandledOverlayInterstitial =
    finishedAttempt !== null && handledInterstitialAttemptRef.current === finishedAttempt.id;
  const isAutoInterstitialPending = isAutoInterstitialTrigger && !hasHandledOverlayInterstitial;
  const isInteractionLocked = isStartScreenBlocking || isInterstitialActive || isAutoInterstitialPending;
  const canShowRewardedUndo = overlayMode === "lost" && Boolean(gameRef.current?.canUndoLastMove());
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
  const shouldShowMobileJoystick =
    overlayMode === "playing" && !isLevelSelectOpen && !isLeaderboardOpen && !isInteractionLocked && isFirstSceneRenderable && !isStartScreenBlocking;
  const pauseButtonLabel = overlayMode === "paused" ? "Продолжить" : "Пауза";
  const shareStatusLabel =
    shareStatus === "copied"
      ? "Ссылка скопирована"
      : shareStatus === "shared"
        ? "Ссылка отправлена"
        : shareStatus === "error"
          ? "Не удалось скопировать ссылку"
          : "";

  const getShareContext = (): SharedResultContext => {
    if (overlayMode === "won" && finishedAttempt?.outcome === "win") {
      const resultStars = stars === 1 || stars === 2 || stars === 3 ? stars : 1;

      return {
        kind: "level",
        levelNumber: levelIdx + 1,
        levelName: currentLevel.name,
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
          title: "Hop & Fill: результат",
          text: "Мой результат в Hop & Fill",
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
        Поделиться результатом
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
              Открыть результат
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
          onStart={() => {}}
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
      <header className="absolute top-0 left-0 right-0 px-2 sm:px-4 py-2 sm:py-3 pointer-events-none">
        <div className="flex items-center justify-between gap-2">
          <div className="pointer-events-auto flex items-baseline gap-1.5 min-w-0">
            <h1 className="text-white text-base sm:text-lg font-bold truncate [text-shadow:0_2px_6px_rgba(0,0,0,0.85)]">
              Hop &amp; Fill
            </h1>
            <span className="hidden sm:inline text-white/85 text-sm truncate [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
              · {currentLevel.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 pointer-events-auto shrink-0">
            <div className="bg-black/60 backdrop-blur px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-white text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap ring-1 ring-white/10">
              {hops}/{limit}
            </div>
            <div
              className="bg-black/60 backdrop-blur px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-white text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap ring-1 ring-white/10"
              title="Идеальное число ходов"
            >
              ★ {optimal}
            </div>
            <div
              className="flex items-center gap-1 bg-black/60 backdrop-blur px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-white text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap ring-1 ring-white/10"
              title="Время попытки"
            >
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {formattedElapsedTime}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={toggleMute}
              className="h-7 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm"
              title={progress.audioMuted ? "Включить звук" : "Выключить звук"}
              aria-pressed={progress.audioMuted}
            >
              {progress.audioMuted ? <VolumeX className="h-3.5 w-3.5" aria-hidden /> : <Volume2 className="h-3.5 w-3.5" aria-hidden />}
              <span className="hidden sm:inline">{progress.audioMuted ? "Звук выкл" : "Звук вкл"}</span>
            </Button>
            <Button size="sm" variant="secondary" onClick={restart} disabled={isInteractionLocked} className="h-7 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Заново</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={overlayMode === "paused" ? resumeGameplay : openPauseMenu}
              className="h-7 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm"
            >
              {overlayMode === "paused" ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
              <span className="hidden sm:inline">{pauseButtonLabel}</span>
            </Button>
          </div>
        </div>

        {/* Выбор уровня — отдельной строкой под HUD */}
        <div className="mt-1.5 sm:mt-2 flex items-center justify-center gap-2 pointer-events-auto">
            <Button
              size="sm"
              variant="ghost"
              onClick={openLevelSelect}
              disabled={isInteractionLocked}
              className="h-7 bg-black/60 px-2.5 text-xs text-white ring-1 ring-white/10 backdrop-blur hover:bg-black/75 hover:text-white sm:h-9 sm:px-3 sm:text-sm"
            >
            <Map className="h-3.5 w-3.5" aria-hidden />
            Уровень {levelIdx + 1} / {levels.length}
          </Button>
          {currentChapter && (
            <div className="hidden sm:block bg-black/50 backdrop-blur px-2.5 py-1 rounded-md text-white/80 text-xs whitespace-nowrap ring-1 ring-white/10">
              Глава {currentChapter.chapterIndex} · {currentChapter.themeLabel}
            </div>
          )}
          <div className="bg-black/60 backdrop-blur px-2.5 py-1 rounded-md text-white text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap ring-1 ring-white/10">
            ★ {totalStars}/{maxStars}
          </div>
          {maxRaces > 0 && (
            <div
              className="flex items-center gap-1 bg-black/60 px-2.5 py-1 text-xs font-semibold text-cyan-100 backdrop-blur rounded-md ring-1 ring-white/10 sm:text-sm"
              title="Гонки за быстрое прохождение"
            >
              <CarFront className="h-3.5 w-3.5 text-cyan-200" aria-hidden />
              <span className="tabular-nums">
                {totalRaces}/{maxRaces}
              </span>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={openLeaderboard}
            disabled={isInteractionLocked}
            className="h-7 bg-black/60 px-2.5 text-xs text-white ring-1 ring-white/10 backdrop-blur hover:bg-black/75 hover:text-white sm:h-9 sm:px-3 sm:text-sm"
          >
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            <span>Лидеры</span>
          </Button>
          {formattedBestTime && (
            <div className="hidden bg-black/50 px-2.5 py-1 text-xs text-white/80 backdrop-blur rounded-md ring-1 ring-white/10 sm:block">
              Лучшее время: {formattedBestTime}
            </div>
          )}
          {formattedRaceTarget && (
            <div
              className={`hidden items-center gap-1 rounded-md bg-black/50 px-2.5 py-1 text-xs backdrop-blur ring-1 ring-white/10 sm:flex ${hasCurrentRaceAward ? "text-cyan-100" : "text-white/80"}`}
              title="Показатель для гонки"
            >
              <CarFront className="h-3.5 w-3.5 text-cyan-200" aria-hidden />
              {hasCurrentRaceAward ? "Гонка получена" : `Гонка: ${formattedRaceTarget}`}
            </div>
          )}
          {saveState !== "idle" && (
            <div className="hidden sm:block bg-black/50 backdrop-blur px-2.5 py-1 rounded-md text-white/80 text-xs whitespace-nowrap ring-1 ring-white/10">
              {saveState === "saving" ? "Сохранение..." : "Не сохранено"}
            </div>
          )}
        </div>
      </header>

      {shouldShowKeyboardCompass && <KeyboardCompassHint />}

      {shouldShowMobileJoystick && (
        <MobileJoystick onDirection={(dir) => gameRef.current?.triggerDir(dir)} />
      )}

      {/* Оверлеи */}
      {overlayMode !== "playing" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/72 px-4 backdrop-blur-sm">
          <div className={`relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-black/75 p-5 text-center text-white shadow-2xl ring-1 ring-white/10 sm:p-6 ${isPerfectWin ? "perfect-win-panel" : ""}`}>
            {overlayMode === "won" && (
              <div className="relative z-10">
                {isPerfectWin && <PerfectCelebration />}
                <h2 className="text-2xl font-bold">Уровень пройден!</h2>
                {isPerfectWin && (
                  <div className="perfect-win-badge mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-yellow-200/45 bg-yellow-300/15 px-3 py-1 text-xs font-bold uppercase text-yellow-100 shadow-[0_0_28px_rgba(250,204,21,0.24)]">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Идеально!
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
                      Лучший результат: {bestStars} ★
                    </div>
                  )}
                </div>
                <p className="mt-4 text-sm text-white/75">
                  Ходов: {hops} · идеал: {optimal}
                </p>
                <p className="mt-2 text-sm text-white/75">
                  Время: {formattedElapsedTime}
                  {formattedBestTime ? ` · лучшее: ${formattedBestTime}` : ""}
                </p>
                {formattedRaceTarget && (
                  <div
                    className={`mx-auto mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold ${hasCurrentRaceAward ? "border-cyan-200/45 bg-cyan-200/10 text-cyan-100" : "border-white/15 bg-white/5 text-white/70"}`}
                  >
                    <CarFront className="h-3.5 w-3.5 text-cyan-200" aria-hidden />
                    {hasCurrentRaceAward ? "Гонка получена" : `Гонка за ${formattedRaceTarget}`}
                  </div>
                )}
                <div className="mt-5 flex flex-col gap-2">
                  <Button onClick={continueAfterWin} disabled={isInteractionLocked} className="w-full">
                    {levelIdx === levels.length - 1
                      ? "К финальному экрану"
                      : pendingChapterTransition
                        ? `Открыть главу ${pendingChapterTransition.toChapter.chapterIndex}`
                        : "Следующий уровень"}
                  </Button>
                  {shareResultControls}
                  <Button onClick={restart} disabled={isInteractionLocked} variant="secondary" className="w-full">
                    Сыграть снова
                  </Button>
                </div>
              </div>
            )}

            {overlayMode === "lost" && (
              <>
                <h2 className="text-2xl font-bold">Ходы закончились</h2>
                <p className="mt-3 text-sm text-white/75">
                  Ты исчерпал лимит ходов. Попробуй другой маршрут и уложись в {limit}.
                </p>
                <p className="mt-2 text-sm text-white/65">
                  Время попытки: {formattedElapsedTime}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {canShowRewardedUndo && (
                    <Button onClick={triggerRewardedUndo} disabled={rewardedUndoState === "loading"} className="w-full">
                      {rewardedUndoState === "loading" ? "Загрузка награды..." : "Посмотреть рекламу и отменить ход"}
                    </Button>
                  )}
                  <Button onClick={restart} disabled={isInteractionLocked} className="w-full">
                    Перезапустить
                  </Button>
                  <Button onClick={openLevelSelect} disabled={isInteractionLocked} variant="secondary" className="w-full">
                    К выбору уровней
                  </Button>
                </div>
                {rewardedUndoState === "error" && (
                  <p className="mt-3 text-xs text-white/65">
                    Награду не удалось получить. Попробуй снова или начни уровень заново.
                  </p>
                )}
              </>
            )}

            {overlayMode === "paused" && (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                  Меню
                </p>
                <h2 className="mt-2 text-2xl font-bold">Пауза</h2>
                <p className="mt-3 text-sm text-white/75">
                  Игра остановлена. Продолжай сейчас или открой другой уровень.
                </p>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                  <div className="flex items-center justify-between gap-2 text-xs text-white/70">
                    <span>Сейчас</span>
                    <span>
                      Уровень {levelIdx + 1}
                      {currentChapter ? ` · глава ${currentChapter.chapterIndex}` : ""}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-white/75 sm:grid-cols-2">
                    <div className="rounded-lg bg-black/25 px-3 py-2">
                      <div className="font-semibold text-white">ПК</div>
                      <div className="mt-1">Мышь: клик по соседней плитке</div>
                      <div className="mt-1">Стрелки: диагонали одним нажатием</div>
                      <div className="mt-1">WASD: прямые ходы · сочетания WASD: диагонали</div>
                    </div>
                    <div className="rounded-lg bg-black/25 px-3 py-2">
                      <div className="font-semibold text-white">Телефон</div>
                      <div className="mt-1">Свайпай или тяни джойстик в сторону соседней плитки</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                    <span className="rounded-md bg-black/30 px-2 py-1">Ходы: {hops}/{limit}</span>
                    <span className="rounded-md bg-black/30 px-2 py-1">Лучший результат: {bestStars || "—"} ★</span>
                    {maxRaces > 0 && <span className="rounded-md bg-black/30 px-2 py-1">Гонки: {totalRaces}/{maxRaces}</span>}
                    <span className="rounded-md bg-black/30 px-2 py-1">Время: {formattedElapsedTime}</span>
                    <span className="rounded-md bg-black/30 px-2 py-1">Лучшее время: {formattedBestTime ?? "—"}</span>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <Button onClick={resumeGameplay} className="w-full">
                    <Play className="mr-2 h-4 w-4" aria-hidden />
                    Продолжить
                  </Button>
                  <Button onClick={restart} variant="secondary" className="w-full">
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                    Начать заново
                  </Button>
                  <Button onClick={openLevelSelect} variant="secondary" className="w-full">
                    <Map className="mr-2 h-4 w-4" aria-hidden />
                    К выбору уровней
                  </Button>
                </div>
              </>
            )}

            {overlayMode === "chapter" && pendingChapterTransition && (
              <>
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
                  <Trophy className="h-5 w-5 text-yellow-300" aria-hidden />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                  Новая глава
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  Глава {pendingChapterTransition.toChapter.chapterIndex}
                </h2>
                <p className="mt-2 text-sm text-white/75">
                  {pendingChapterTransition.toChapter.themeLabel} · уровни {pendingChapterTransition.toChapter.startLevelIndex + 1}
                  -{pendingChapterTransition.toChapter.endLevelIndex + 1}
                </p>
                <p className="mt-3 text-sm text-white/65">
                  Палитра меняется после главы {pendingChapterTransition.fromChapter.chapterIndex}. Первый уровень уже готов.
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <Button onClick={startChapterLevel} className="w-full">
                    Начать главу
                  </Button>
                  <Button onClick={openLevelSelect} variant="secondary" className="w-full">
                    К выбору уровней
                  </Button>
                </div>
              </>
            )}

            {overlayMode === "final" && (
              <>
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-yellow-300/20 ring-1 ring-yellow-300/30">
                  <Trophy className="h-5 w-5 text-yellow-300" aria-hidden />
                </div>
                <h2 className="mt-4 text-2xl font-bold">Все главы пройдены</h2>
                <p className="mt-3 text-sm text-white/75">
                  Ты закрыл все {levels.length} уровней и собрал {totalStars} из {maxStars} звёзд
                  {maxRaces > 0 ? ` и ${totalRaces} из ${maxRaces} гонок` : ""}.
                </p>
                <p className="mt-2 text-sm text-white/65">
                  Финал открыт для перепрохождения, а любые уровни доступны через меню выбора.
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {shareResultControls}
                  <Button onClick={restart} className="w-full">
                    Переиграть финальный уровень
                  </Button>
                  <Button onClick={openLevelSelect} variant="secondary" className="w-full">
                    К выбору уровней
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
          onStart={startFromStartScreen}
        />
      )}
    </div>
  );
};

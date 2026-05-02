import { useCallback, useEffect, useRef, useState } from "react";
import { Map, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX } from "lucide-react";
import { PixiGame } from "@/game/PixiGame";
import { createGameAudio } from "@/game/audio";
import { decideInterstitialTrigger, type InterstitialTrigger } from "@/game/interstitials";
import { levels } from "@/game/levels";
import { deriveChapters, getChapterForLevel, getChapterTransition, type ChapterTransition } from "@/game/levels/chapters";
import { computeOptimalMoves, computeStars, moveLimit } from "@/game/difficulty";
import { subscribeToFullscreenAds, ysdkGameplayStart, ysdkGameplayStop, ysdkReady, ysdkShowAd, ysdkShowRewardedAd } from "@/sdk/yandex";
import { Button } from "@/components/ui/button";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { LevelSelect } from "@/components/LevelSelect";
import { ParallaxBackground, type BgTheme } from "@/components/ParallaxBackground";
import {
  completeLevel,
  completeTutorial,
  createDefaultProgress,
  getBestStars,
  getTotalStars,
  isLevelUnlocked,
  loadPlayerProgress,
  savePlayerProgress,
  setAudioMuted,
  type PlayerProgress,
} from "@/game/progress";

type OverlayMode = "playing" | "paused" | "won" | "lost" | "chapter" | "final";

const chapters = deriveChapters(levels);

const Star = ({ filled }: { filled: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-8 h-8 ${filled ? "text-yellow-400" : "text-muted-foreground/40"}`}
    fill="currentColor"
    aria-hidden
  >
    <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1L12 2z" />
  </svg>
);

const getNextLevelContext = (fromLevelIdx: number) => {
  const nextLevelIdx = fromLevelIdx + 1;
  if (nextLevelIdx >= levels.length) {
    return { nextLevelIdx: null, nextLevel: null };
  }

  return { nextLevelIdx, nextLevel: levels[nextLevelIdx] };
};

interface FinishedAttempt {
  id: number;
  outcome: "win" | "loss";
  levelIdx: number;
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
  const [hops, setHops] = useState(0);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("playing");
  const [pendingChapterTransition, setPendingChapterTransition] = useState<ChapterTransition | null>(null);
  const [levelIdx, setLevelIdx] = useState(0);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [finishedAttempt, setFinishedAttempt] = useState<FinishedAttempt | null>(null);
  const [isLevelSelectOpen, setLevelSelectOpen] = useState(false);
  const [isInterstitialActive, setInterstitialActive] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [rewardedUndoState, setRewardedUndoState] = useState<"idle" | "loading" | "error">("idle");
  const [isDocumentVisible, setDocumentVisible] = useState(() => document.visibilityState !== "hidden");
  const [isFirstSceneRenderable, setFirstSceneRenderable] = useState(false);
  const lastGameplayActiveRef = useRef<boolean | null>(null);

  const currentLevel = levels[levelIdx];
  const optimal = computeOptimalMoves(currentLevel);
  const limit = moveLimit(optimal);
  const progressReady = progress !== null;

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
    if (!progressReady) return;
    if (!hostRef.current) return;
    const game = new PixiGame(hostRef.current, currentLevel, {
      onHopCount: setHops,
      onHop: () => audioRef.current?.playHop(),
      onPaint: () => audioRef.current?.playPaint(),
      onWin: (winningHops) => {
        audioRef.current?.playWin();
        const wonLevelIdx = levelIdxRef.current;
        const wonLevel = levels[wonLevelIdx];
        const wonStars = computeStars(winningHops, computeOptimalMoves(wonLevel));
        const baseProgress = progressRef.current ?? createDefaultProgress();
        const wonLevelNumber = wonLevelIdx + 1;
        const didCompleteNewLevel = !baseProgress.completedLevels.includes(wonLevelNumber);
        const nextProgress = completeLevel(baseProgress, wonLevelIdx, wonStars, levels.length);
        persistProgress(nextProgress);
        setFinishedAttempt({
          id: ++attemptIdRef.current,
          outcome: "win",
          levelIdx: wonLevelIdx,
          completedLevelsCount: nextProgress.completedLevels.length,
          didCompleteNewLevel,
        });
        setPendingChapterTransition(getChapterTransition(levels, wonLevelIdx));
        setOverlayMode("won");
      },
      onLose: () => {
        audioRef.current?.playLoss();
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
    setHops(0);
  }, [levelIdx, currentLevel, limit, progressReady]);

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

    if (overlayMode !== "playing" || isLevelSelectOpen) {
      game.pause();
      return;
    }

    game.resume();
  }, [overlayMode, isLevelSelectOpen]);

  const loadLevel = (nextLevelIdx: number) => {
    if (nextLevelIdx === levelIdx) {
      gameRef.current?.setLevel(levels[nextLevelIdx]);
      gameRef.current?.setMoveLimit(moveLimit(computeOptimalMoves(levels[nextLevelIdx])));
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
    resumeGameplay();
    setHops(0);
  };

  const openLevelSelect = () => {
    setLevelSelectOpen(true);
  };

  const closeLevelSelect = () => {
    setLevelSelectOpen(false);
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

  const stars = overlayMode === "won" ? computeStars(hops, optimal) : 0;
  const bestStars = progress ? getBestStars(progress, levelIdx) : 0;
  const totalStars = progress ? getTotalStars(progress) : 0;
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
  const isAutoInterstitialPending =
    overlayInterstitialTrigger === "after-loss" || overlayInterstitialTrigger === "periodic-win";
  const isInteractionLocked = isInterstitialActive || isAutoInterstitialPending;
  const canShowRewardedUndo = overlayMode === "lost" && Boolean(gameRef.current?.canUndoLastMove());
  const isTutorialBlocking = levelIdx === 0 && progress !== null && !progress.tutorialComplete;
  const isGameplayActive = progressReady
    && isFirstSceneRenderable
    && overlayMode === "playing"
    && !isLevelSelectOpen
    && !isTutorialBlocking
    && isDocumentVisible;
  const bgTheme: BgTheme = (currentLevel.theme as BgTheme) ?? "default";
  const currentChapter = getChapterForLevel(chapters, levelIdx);
  const shouldShowGameplayHint = overlayMode === "playing" && !isLevelSelectOpen && hops === 0 && levelIdx === 0;
  const pauseButtonLabel = overlayMode === "paused" ? "Продолжить" : "Пауза";

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
        <ParallaxBackground theme="default" />
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="rounded-lg border border-white/[0.15] bg-black/[0.65] px-5 py-4 text-center text-white shadow-xl backdrop-blur">
            <div className="text-sm font-semibold">Загрузка прогресса...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden touch-none select-none">
      <ParallaxBackground theme={bgTheme} />
      <div ref={hostRef} className="absolute inset-0" />

      {/* Интерактивный туториал — только для первого уровня и пока игрок не пройдёт его */}
      {overlayMode === "playing" && !isLevelSelectOpen && (
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
            ★ {totalStars}/{levels.length * 3}
          </div>
          {saveState !== "idle" && (
            <div className="hidden sm:block bg-black/50 backdrop-blur px-2.5 py-1 rounded-md text-white/80 text-xs whitespace-nowrap ring-1 ring-white/10">
              {saveState === "saving" ? "Сохранение..." : "Не сохранено"}
            </div>
          )}
        </div>
      </header>

      {/* Подсказка управления (только для десктопа на первой загрузке) */}
      {shouldShowGameplayHint && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/65 backdrop-blur px-4 py-2 rounded-md text-white text-sm text-center pointer-events-none ring-1 ring-white/10">
          Мышь / стрелки / WASD на ПК · свайп на телефоне
        </div>
      )}

      {/* Оверлеи */}
      {overlayMode !== "playing" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/72 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/75 p-5 text-center text-white shadow-2xl ring-1 ring-white/10 sm:p-6">
            {overlayMode === "won" && (
              <>
                <h2 className="text-2xl font-bold">Уровень пройден!</h2>
                <div className="mt-4 flex flex-col items-center gap-2">
                  <div className="flex justify-center gap-1">
                    <Star filled={stars >= 1} />
                    <Star filled={stars >= 2} />
                    <Star filled={stars >= 3} />
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
                <div className="mt-5 flex flex-col gap-2">
                  <Button onClick={continueAfterWin} disabled={isInteractionLocked} className="w-full">
                    {levelIdx === levels.length - 1
                      ? "К финальному экрану"
                      : pendingChapterTransition
                        ? `Открыть главу ${pendingChapterTransition.toChapter.chapterIndex}`
                        : "Следующий уровень"}
                  </Button>
                  <Button onClick={restart} disabled={isInteractionLocked} variant="secondary" className="w-full">
                    Сыграть снова
                  </Button>
                </div>
              </>
            )}

            {overlayMode === "lost" && (
              <>
                <h2 className="text-2xl font-bold">Ходы закончились</h2>
                <p className="mt-3 text-sm text-white/75">
                  Ты исчерпал лимит ходов. Попробуй другой маршрут и уложись в {limit}.
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
                      <div className="mt-1">Мышь, стрелки или WASD</div>
                    </div>
                    <div className="rounded-lg bg-black/25 px-3 py-2">
                      <div className="font-semibold text-white">Телефон</div>
                      <div className="mt-1">Свайпай в сторону соседней плитки</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                    <span className="rounded-md bg-black/30 px-2 py-1">Ходы: {hops}/{limit}</span>
                    <span className="rounded-md bg-black/30 px-2 py-1">Лучший результат: {bestStars || "—"} ★</span>
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
                  Ты закрыл все {levels.length} уровней и собрал {totalStars} из {levels.length * 3} звёзд.
                </p>
                <p className="mt-2 text-sm text-white/65">
                  Финал открыт для перепрохождения, а любые уровни доступны через меню выбора.
                </p>
                <div className="mt-5 flex flex-col gap-2">
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
    </div>
  );
};

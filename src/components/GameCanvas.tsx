import { useEffect, useRef, useState } from "react";
import { Map, RotateCcw } from "lucide-react";
import { PixiGame } from "@/game/PixiGame";
import { levels } from "@/game/levels";
import { computeOptimalMoves, computeStars, moveLimit } from "@/game/difficulty";
import { ysdkGameplayStart, ysdkGameplayStop, ysdkReady } from "@/sdk/yandex";
import { Button } from "@/components/ui/button";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { LevelSelect } from "@/components/LevelSelect";
import { ParallaxBackground, type BgTheme } from "@/components/ParallaxBackground";
import type { Dir } from "@/game/iso";
import {
  completeLevel,
  completeTutorial,
  createDefaultProgress,
  getBestStars,
  getTotalStars,
  isLevelUnlocked,
  loadPlayerProgress,
  savePlayerProgress,
  type PlayerProgress,
} from "@/game/progress";

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

export const GameCanvas = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PixiGame | null>(null);
  const levelIdxRef = useRef(0);
  const progressRef = useRef<PlayerProgress | null>(null);
  const [hops, setHops] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [levelIdx, setLevelIdx] = useState(0);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [isLevelSelectOpen, setLevelSelectOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [isDocumentVisible, setDocumentVisible] = useState(() => document.visibilityState !== "hidden");
  const [isFirstSceneRenderable, setFirstSceneRenderable] = useState(false);
  const lastGameplayActiveRef = useRef<boolean | null>(null);

  const currentLevel = levels[levelIdx];
  const optimal = computeOptimalMoves(currentLevel);
  const limit = moveLimit(optimal);
  const progressReady = progress !== null;

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
    if (!progressReady) return;
    if (!hostRef.current) return;
    const game = new PixiGame(hostRef.current, currentLevel, {
      onHopCount: setHops,
      onWin: (winningHops) => {
        const wonLevelIdx = levelIdxRef.current;
        const wonLevel = levels[wonLevelIdx];
        const wonStars = computeStars(winningHops, computeOptimalMoves(wonLevel));
        const baseProgress = progressRef.current ?? createDefaultProgress();
        const nextProgress = completeLevel(baseProgress, wonLevelIdx, wonStars, levels.length);
        persistProgress(nextProgress);
        setStatus("won");
      },
      onLose: () => setStatus("lost"),
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
    setStatus("playing");
    setHops(0);
  }, [levelIdx, currentLevel, limit, progressReady]);

  const restart = () => {
    gameRef.current?.reset();
    setStatus("playing");
    setHops(0);
  };

  const nextLevel = () => {
    if (!progress) return;
    const nextIdx = levelIdx + 1;
    if (nextIdx < levels.length && isLevelUnlocked(progress, nextIdx)) {
      setLevelIdx(nextIdx);
    }
  };

  const selectLevel = (nextLevelIdx: number) => {
    if (!progress || !isLevelUnlocked(progress, nextLevelIdx)) return;
    setLevelIdx(nextLevelIdx);
    setLevelSelectOpen(false);
  };

  const markTutorialComplete = () => {
    const baseProgress = progressRef.current;
    if (!baseProgress) return;
    persistProgress(completeTutorial(baseProgress, levels.length));
  };

  const tap = (dir: Dir) => gameRef.current?.triggerDir(dir);
  void tap;

  const stars = status === "won" ? computeStars(hops, optimal) : 0;
  const bestStars = progress ? getBestStars(progress, levelIdx) : 0;
  const totalStars = progress ? getTotalStars(progress) : 0;
  const canPlayNext = Boolean(progress && levelIdx < levels.length - 1 && isLevelUnlocked(progress, levelIdx + 1));
  const isTutorialBlocking = levelIdx === 0 && progress !== null && !progress.tutorialComplete;
  const isGameplayActive = progressReady
    && isFirstSceneRenderable
    && status === "playing"
    && !isLevelSelectOpen
    && !isTutorialBlocking
    && isDocumentVisible;

  const bgTheme: BgTheme = (currentLevel.theme as BgTheme) ?? "default";

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
      <TutorialOverlay
        levelIdx={levelIdx}
        hops={hops}
        tutorialComplete={progress.tutorialComplete}
        onComplete={markTutorialComplete}
      />


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
            <Button size="sm" variant="secondary" onClick={restart} className="h-7 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Заново</span>
            </Button>
          </div>
        </div>

        {/* Выбор уровня — отдельной строкой под HUD */}
        <div className="mt-1.5 sm:mt-2 flex items-center justify-center gap-2 pointer-events-auto">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLevelSelectOpen(true)}
            className="h-7 bg-black/60 px-2.5 text-xs text-white ring-1 ring-white/10 backdrop-blur hover:bg-black/75 hover:text-white sm:h-9 sm:px-3 sm:text-sm"
          >
            <Map className="h-3.5 w-3.5" aria-hidden />
            Уровень {levelIdx + 1} / {levels.length}
          </Button>
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
      {status === "playing" && hops === 0 && levelIdx === 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/65 backdrop-blur px-4 py-2 rounded-md text-white text-sm text-center pointer-events-none ring-1 ring-white/10">
          Мышь / стрелки / WASD на ПК · свайп на телефоне
        </div>
      )}

      {/* Оверлеи */}
      {status !== "playing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="bg-card text-card-foreground rounded-lg p-6 shadow-xl text-center max-w-xs mx-4">
            <h2 className="text-2xl font-bold mb-2">
              {status === "won" ? "Уровень пройден!" : "Упс, мимо!"}
            </h2>

            {status === "won" && (
              <div className="flex flex-col items-center gap-2 mb-3">
                <div className="flex justify-center gap-1">
                  <Star filled={stars >= 1} />
                  <Star filled={stars >= 2} />
                  <Star filled={stars >= 3} />
                </div>
                {bestStars > stars && (
                  <div className="text-xs font-medium text-muted-foreground">
                    Лучший результат: {bestStars} ★
                  </div>
                )}
              </div>
            )}

            <p className="text-muted-foreground mb-5">
              {status === "won"
                ? `Ходов: ${hops} · идеал: ${optimal}`
                : "Закончились ходы или прыжок в пустоту."}
            </p>

            <div className="flex flex-col gap-2">
              {status === "won" && canPlayNext && (
                <Button onClick={nextLevel} className="w-full">
                  Следующий уровень
                </Button>
              )}
              {status === "won" && !canPlayNext && (
                <Button onClick={() => setLevelSelectOpen(true)} className="w-full">
                  Выбрать уровень
                </Button>
              )}
              <Button onClick={restart} variant={status === "won" ? "secondary" : "default"} className="w-full">
                {status === "won" ? "Сыграть снова" : "Перезапустить"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <LevelSelect
        open={isLevelSelectOpen}
        levels={levels}
        progress={progress}
        currentLevelIndex={levelIdx}
        onClose={() => setLevelSelectOpen(false)}
        onSelectLevel={selectLevel}
      />
    </div>
  );
};

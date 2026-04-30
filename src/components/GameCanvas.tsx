import { useEffect, useRef, useState } from "react";
import { PixiGame } from "@/game/PixiGame";
import { levels } from "@/game/levels";
import { computeOptimalMoves, computeStars, moveLimit } from "@/game/difficulty";
import { ysdkReady } from "@/sdk/yandex";
import { Button } from "@/components/ui/button";
import type { Dir } from "@/game/iso";

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
  const [hops, setHops] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [levelIdx, setLevelIdx] = useState(0);

  const currentLevel = levels[levelIdx];
  const optimal = computeOptimalMoves(currentLevel);
  const limit = moveLimit(optimal);

  useEffect(() => {
    if (!hostRef.current) return;
    const game = new PixiGame(hostRef.current, currentLevel, {
      onHopCount: setHops,
      onWin: () => setStatus("won"),
      onLose: () => setStatus("lost"),
    });
    game.setMoveLimit(limit);
    gameRef.current = game;
    ysdkReady().catch(() => {});
    return () => {
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // При смене уровня — обновляем игру
  useEffect(() => {
    if (!gameRef.current) return;
    gameRef.current.setLevel(currentLevel);
    gameRef.current.setMoveLimit(limit);
    setStatus("playing");
    setHops(0);
  }, [levelIdx, currentLevel, limit]);

  const restart = () => {
    gameRef.current?.reset();
    setStatus("playing");
    setHops(0);
  };

  const nextLevel = () => {
    if (levelIdx < levels.length - 1) setLevelIdx((i) => i + 1);
    else restart();
  };

  const prevLevel = () => {
    if (levelIdx > 0) setLevelIdx((i) => i - 1);
  };

  const tap = (dir: Dir) => gameRef.current?.triggerDir(dir);
  void tap;

  const stars = status === "won" ? computeStars(hops, optimal) : 0;

  return (
    <div className="relative w-full h-full overflow-hidden touch-none select-none">
      <div ref={hostRef} className="absolute inset-0" />

      {/* HUD */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <h1 className="text-foreground text-lg font-bold drop-shadow">Pogo Paint</h1>
          <span className="text-muted-foreground text-sm">· {currentLevel.name}</span>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="bg-background/60 backdrop-blur px-3 py-1.5 rounded-md text-foreground text-sm font-medium tabular-nums">
            Ходы: {hops} / {limit}
          </div>
          <div
            className="bg-background/60 backdrop-blur px-3 py-1.5 rounded-md text-foreground text-sm font-medium tabular-nums"
            title="Идеальное число ходов"
          >
            ★ {optimal}
          </div>
          <Button size="sm" variant="secondary" onClick={restart}>
            Заново
          </Button>
        </div>
      </header>

      {/* Навигация по уровням */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-auto">
        <Button size="sm" variant="ghost" onClick={prevLevel} disabled={levelIdx === 0}>
          ←
        </Button>
        <span className="text-foreground text-sm bg-background/60 backdrop-blur px-3 py-1 rounded-md">
          Уровень {levelIdx + 1} / {levels.length}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => levelIdx < levels.length - 1 && setLevelIdx((i) => i + 1)}
          disabled={levelIdx === levels.length - 1}
        >
          →
        </Button>
      </div>

      {/* Подсказка управления (только для десктопа на первой загрузке) */}
      {status === "playing" && hops === 0 && levelIdx === 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background/60 backdrop-blur px-4 py-2 rounded-md text-foreground text-sm text-center pointer-events-none">
          Мышь / стрелки / WASD на ПК · свайп на телефоне
        </div>
      )}

      {/* Оверлеи */}
      {status !== "playing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="bg-card text-card-foreground rounded-xl p-6 shadow-xl text-center max-w-xs mx-4">
            <h2 className="text-2xl font-bold mb-2">
              {status === "won" ? "Уровень пройден!" : "Упс, мимо!"}
            </h2>

            {status === "won" && (
              <div className="flex justify-center gap-1 mb-3">
                <Star filled={stars >= 1} />
                <Star filled={stars >= 2} />
                <Star filled={stars >= 3} />
              </div>
            )}

            <p className="text-muted-foreground mb-5">
              {status === "won"
                ? `Ходов: ${hops} · идеал: ${optimal}`
                : "Закончились ходы или прыжок в пустоту."}
            </p>

            <div className="flex flex-col gap-2">
              {status === "won" && levelIdx < levels.length - 1 && (
                <Button onClick={nextLevel} className="w-full">
                  Следующий уровень
                </Button>
              )}
              <Button onClick={restart} variant={status === "won" ? "secondary" : "default"} className="w-full">
                {status === "won" ? "Сыграть снова" : "Перезапустить"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

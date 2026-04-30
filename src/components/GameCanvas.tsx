import { useEffect, useRef, useState } from "react";
import { PixiGame } from "@/game/PixiGame";
import { level1 } from "@/game/levels/level1";
import { ysdkReady } from "@/sdk/yandex";
import { Button } from "@/components/ui/button";
import type { Dir } from "@/game/iso";

export const GameCanvas = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PixiGame | null>(null);
  const [hops, setHops] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");

  useEffect(() => {
    if (!hostRef.current) return;
    const game = new PixiGame(hostRef.current, level1, {
      onHopCount: setHops,
      onWin: () => setStatus("won"),
      onLose: () => setStatus("lost"),
    });
    gameRef.current = game;
    ysdkReady().catch(() => {});
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const restart = () => {
    gameRef.current?.reset();
    setStatus("playing");
    setHops(0);
  };

  const tap = (dir: Dir) => gameRef.current?.triggerDir(dir);

  return (
    <div className="relative w-full h-full overflow-hidden touch-none select-none">
      <div ref={hostRef} className="absolute inset-0" />

      {/* HUD */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 pointer-events-none">
        <h1 className="text-foreground text-lg font-bold drop-shadow pointer-events-auto">
          Pogo Paint
        </h1>
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="bg-background/60 backdrop-blur px-3 py-1.5 rounded-md text-foreground text-sm font-medium">
            Прыжки: {hops}
          </div>
          <Button size="sm" variant="secondary" onClick={restart}>
            Заново
          </Button>
        </div>
      </header>

      {/* Подсказка управления (только для десктопа на первой загрузке) */}
      {status === "playing" && hops === 0 && (
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
            <p className="text-muted-foreground mb-5">
              {status === "won"
                ? `Все плитки закрашены за ${hops} прыжков.`
                : "Попробуй ещё раз — закрась каждую плитку."}
            </p>
            <Button onClick={restart} className="w-full">
              {status === "won" ? "Сыграть снова" : "Перезапустить"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

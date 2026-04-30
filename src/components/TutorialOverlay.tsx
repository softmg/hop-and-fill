import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "hasSeenTutorial";

interface TutorialOverlayProps {
  /** Текущий индекс уровня (туториал только для levelIdx === 0) */
  levelIdx: number;
  /** Сколько ходов сделал игрок (передаётся из GameCanvas) */
  hops: number;
}

type Step = "move" | "limit" | "done";

/**
 * Интерактивный онбординг для первого уровня.
 * - Шаг 1: подсказка про управление + пульсирующая стрелка над персонажем.
 * - Шаг 2: подсветка верхнего HUD (ходы / звёзды).
 * Прогресс сохраняется в localStorage, повторно не показывается.
 */
export const TutorialOverlay = ({ levelIdx, hops }: TutorialOverlayProps) => {
  const [step, setStep] = useState<Step>("done");

  // Инициализация — только для первого уровня и если туториал ещё не пройден.
  useEffect(() => {
    if (levelIdx !== 0) {
      setStep("done");
      return;
    }
    try {
      const seen = localStorage.getItem(STORAGE_KEY) === "true";
      if (seen) {
        setStep("done");
        return;
      }
    } catch {
      // localStorage может быть недоступен — просто продолжаем
    }
    setStep("move");
  }, [levelIdx]);

  // Переход между шагами по действиям игрока.
  useEffect(() => {
    if (step === "move" && hops >= 1) {
      setStep("limit");
    }
    // На втором шаге: если игрок продолжил играть (сделал ещё один ход) — закрываем.
    if (step === "limit" && hops >= 2) {
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hops, step]);

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* noop */
    }
    setStep("done");
  };

  if (step === "done") return null;

  return (
    <div className="absolute inset-0 z-40 pointer-events-none">
      {/* Затемнение фона. На шаге "move" затемняем сильнее, на "limit" мягче.
          Используем pointer-events-none, чтобы не блокировать игру. */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          step === "move" ? "bg-background/70" : "bg-background/40"
        }`}
        aria-hidden
      />

      {step === "move" && (
        <>
          {/* Пульсирующая стрелка-подсказка над центром поля,
              указывает примерно "вниз-вправо" (ось S по изометрии). */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ transform: "translate(-50%, -50%) translate(40px, -40px)" }}
            aria-hidden
          >
            <div className="tutorial-arrow-pulse">
              <svg
                width="72"
                height="72"
                viewBox="0 0 72 72"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ transform: "rotate(135deg)" }}
              >
                <path
                  d="M36 8 L36 56 M36 56 L20 40 M36 56 L52 40"
                  stroke="hsl(var(--tile-start-top))"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Тултип-плашка по центру снизу */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto max-w-sm w-[90%]">
            <div className="bg-card text-card-foreground rounded-xl shadow-2xl px-5 py-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
              <p className="text-sm font-medium leading-relaxed">
                Свайпай или используй стрелки, чтобы двигаться и закрашивать плитки!
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                На ПК — стрелки или WASD · на телефоне — свайп
              </p>
            </div>
          </div>
        </>
      )}

      {step === "limit" && (
        <>
          {/* Подсветка-рамка вокруг верхней панели HUD */}
          <div
            className="absolute top-2 right-2 h-12 rounded-lg ring-2 ring-yellow-400/80 tutorial-glow pointer-events-none"
            style={{ width: "min(420px, calc(100% - 1rem))" }}
            aria-hidden
          />

          {/* Подсказка под HUD */}
          <div className="absolute top-20 right-4 pointer-events-auto max-w-xs">
            <div className="bg-card text-card-foreground rounded-xl shadow-2xl px-5 py-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <p className="text-sm font-medium leading-relaxed">
                Твоя цель — закрасить всё поле за минимальное количество ходов.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Уложишься в идеальное число — получишь 3 звезды! ★★★
              </p>
              <Button size="sm" className="w-full mt-3" onClick={finish}>
                Понятно
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

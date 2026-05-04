import { useEffect, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { FIRST_TUTORIAL_ARROW } from "@/components/tutorialArrow";

interface TutorialOverlayProps {
  /** Текущий индекс уровня (туториал только для levelIdx === 0) */
  levelIdx: number;
  /** Сколько ходов сделал игрок (передаётся из GameCanvas) */
  hops: number;
  tutorialComplete: boolean;
  onComplete: () => void;
}

type Step = "move" | "limit" | "done";

type TutorialArrowStyle = CSSProperties & {
  "--tutorial-arrow-pulse-x"?: string;
  "--tutorial-arrow-pulse-y"?: string;
};

/**
 * Интерактивный онбординг для первого уровня.
 * - Шаг 1: подсказка про управление + пульсирующая стрелка над персонажем.
 * - Шаг 2: подсветка верхнего HUD (ходы / звёзды).
 * Прогресс сохраняется вместе с основным Yandex player data.
 */
export const TutorialOverlay = ({ levelIdx, hops, tutorialComplete, onComplete }: TutorialOverlayProps) => {
  const [step, setStep] = useState<Step>("done");

  // Инициализация — только для первого уровня и если туториал ещё не пройден.
  useEffect(() => {
    if (levelIdx !== 0 || tutorialComplete) {
      setStep("done");
      return;
    }
    setStep("move");
  }, [levelIdx, tutorialComplete]);

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
    onComplete();
    setStep("done");
  };

  const tutorialArrowStyle: TutorialArrowStyle = {
    transform: `translate(-50%, -50%) translate(${FIRST_TUTORIAL_ARROW.offset.x}px, ${FIRST_TUTORIAL_ARROW.offset.y}px)`,
    "--tutorial-arrow-pulse-x": `${FIRST_TUTORIAL_ARROW.pulseOffset.x}px`,
    "--tutorial-arrow-pulse-y": `${FIRST_TUTORIAL_ARROW.pulseOffset.y}px`,
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
          {/* Пульсирующая стрелка использует screen-facing направление из Input/iso,
              чтобы подсказка совпадала с фактическим управлением игрока. */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={tutorialArrowStyle}
            aria-hidden
          >
            <div className="tutorial-arrow-pulse">
              <svg
                width="72"
                height="72"
                viewBox="0 0 72 72"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ transform: `rotate(${FIRST_TUTORIAL_ARROW.rotationDeg}deg)` }}
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
          <div className="absolute bottom-48 left-1/2 -translate-x-1/2 pointer-events-auto max-w-sm w-[90%] sm:bottom-24">
            <div className="bg-card text-card-foreground rounded-xl shadow-2xl px-5 py-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
              <p className="text-sm font-medium leading-relaxed">
                Свайпай, тяни джойстик или используй стрелки, чтобы двигаться и закрашивать плитки!
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                ПК: стрелки — диагонали · WASD — прямые · сочетания WASD — диагонали
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Телефон: свайп или джойстик в сторону соседней плитки
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

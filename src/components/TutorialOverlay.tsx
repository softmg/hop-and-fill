import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { FIRST_TUTORIAL_ARROW } from "@/components/tutorialArrow";
import { useTranslation } from "@/platform/i18n";

interface TutorialOverlayProps {
  /** Текущий индекс уровня (туториал только для levelIdx === 0) */
  levelIdx: number;
  /** Сколько ходов сделал игрок (передаётся из GameCanvas) */
  hops: number;
  tutorialComplete: boolean;
  onComplete: () => void;
}

type Step = "move" | "limit" | "done";

type HighlightRect = {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type TutorialPanelStyle = CSSProperties & {
  "--tutorial-panel-left"?: string;
  "--tutorial-panel-top"?: string;
};

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
  const t = useTranslation();
  const [step, setStep] = useState<Step>("done");
  const overlayRef = useRef<HTMLDivElement>(null);
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([]);

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

  const goalRect = highlightRects[0];
  const limitPanelStyle: TutorialPanelStyle | undefined = goalRect
    ? {
        "--tutorial-panel-left": `clamp(0.75rem, ${goalRect.left}px, calc(100% - 22rem))`,
        "--tutorial-panel-top": `${goalRect.top + goalRect.height + 18}px`,
      }
    : undefined;

  useEffect(() => {
    if (step !== "limit") {
      setHighlightRects([]);
      return;
    }

    const updateRects = () => {
      const overlayRect = overlayRef.current?.getBoundingClientRect();
      if (!overlayRect) return;

      const root = overlayRef.current.parentElement ?? overlayRef.current;
      const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-tutorial-highlight='goal']"));
      setHighlightRects(elements.map((element, index) => {
        const rect = element.getBoundingClientRect();
        return {
          key: `${element.dataset.tutorialHighlight}-${index}`,
          left: rect.left - overlayRect.left,
          top: rect.top - overlayRect.top,
          width: rect.width,
          height: rect.height,
        };
      }));
    };

    updateRects();
    const animationFrame = window.requestAnimationFrame(updateRects);
    window.addEventListener("resize", updateRects);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateRects);
    };
  }, [step]);

  if (step === "done") return null;

  return (
    <div ref={overlayRef} className="absolute inset-0 z-40 pointer-events-none">
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
          <div className="tutorial-move-panel pointer-events-auto">
            <div className="game-panel relative px-5 py-4 text-center text-white animate-in fade-in slide-in-from-bottom-4 duration-300">
              <p className="hidden text-sm font-black leading-relaxed text-[#fff0c2] sm:block">
                {t("moveDesktop")}
              </p>
              <p className="text-sm font-black leading-relaxed text-[#fff0c2] sm:hidden">
                {t("moveMobile")}
              </p>
              <p className="mt-2 hidden text-xs font-semibold text-[#f1d3a0]/80 sm:block">
                {t("desktopHint")}
              </p>
              <p className="mt-2 text-xs font-semibold text-[#f1d3a0]/80 sm:hidden">
                {t("mobileHint")}
              </p>
            </div>
          </div>
        </>
      )}

      {step === "limit" && (
        <>
          {highlightRects.map((rect) => (
            <div
              key={rect.key}
              className="absolute rounded-xl ring-2 ring-yellow-300/85 tutorial-glow pointer-events-none"
              style={{
                left: rect.left - 6,
                top: rect.top - 6,
                width: rect.width + 12,
                height: rect.height + 12,
              }}
              aria-hidden
            />
          ))}

          {/* Подсказка рядом со звёздами HUD */}
          <div
            className="tutorial-limit-panel pointer-events-auto w-[min(21rem,calc(100%-1.5rem))]"
            style={limitPanelStyle}
          >
            <div className="game-panel relative px-5 py-4 text-white animate-in fade-in slide-in-from-top-4 duration-300">
              <p className="text-sm font-black leading-relaxed text-[#fff0c2]">
                {t("goal")}
              </p>
              <p className="mt-2 text-xs font-semibold text-[#f1d3a0]/80">
                {t("goalStars")} ★★★
              </p>
              <Button size="sm" className="w-full mt-3" onClick={finish}>
                {t("understood")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

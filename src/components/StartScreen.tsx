import { CarFront, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import startScreenBg from "@/assets/start-screen-bg_new.jpg";
import { useTranslation } from "@/platform/i18n";

interface StartScreenProps {
  isLoading: boolean;
  isFirstStart: boolean;
  currentLevelNumber: number;
  totalStars: number;
  maxStars: number;
  totalRaces: number;
  maxRaces: number;
  onStart: () => void;
}

export const StartScreen = ({
  isLoading,
  isFirstStart,
  currentLevelNumber,
  totalStars,
  maxStars,
  totalRaces,
  maxRaces,
  onStart,
}: StartScreenProps) => {
  const t = useTranslation();
  const buttonLabel = isLoading ? t("loading") : isFirstStart ? t("start") : t("continue");

  return (
    <section
      aria-label={t("gameTitle")}
      className="absolute inset-0 z-[70] overflow-hidden bg-black text-white [--start-screen-offset:clamp(7rem,18svh,12rem)]"
      data-testid="start-screen"
      onContextMenu={(event) => event.preventDefault()}
    >
      <img
        src={startScreenBg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        decoding="async"
        draggable={false}
      />

      <div className="absolute inset-x-0 top-[clamp(5rem,34svh,18rem)] flex justify-center pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] text-center sm:top-[34%] lg:top-[calc(50%-var(--start-screen-offset))] lg:-translate-y-1/2">
        <h1 className="game-title max-w-[min(64rem,calc(100vw_-_2rem))] text-[clamp(2.25rem,10vw,6rem)] leading-[0.94] [text-wrap:balance]">
          {t("gameTitle")}
        </h1>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex max-h-[48svh] justify-center overflow-y-auto pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[calc(1rem_+_env(safe-area-inset-bottom))] pt-3 sm:pb-[calc(2rem_+_env(safe-area-inset-bottom))] lg:bottom-auto lg:top-[calc(50%+var(--start-screen-offset))] lg:max-h-none lg:-translate-y-1/2 lg:pb-0 lg:pt-0">
        <div className="flex w-full max-w-md flex-col items-center gap-3 px-2 py-3">
          {!isLoading && !isFirstStart && (
            <div className="game-hud-text flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
              <span>{t("level")} {currentLevelNumber}</span>
              <span className="h-1 w-1 rounded-full bg-white/45" aria-hidden />
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" aria-hidden />
                {totalStars}/{maxStars}
              </span>
              {maxRaces > 0 && (
                <>
                  <span className="h-1 w-1 rounded-full bg-white/45" aria-hidden />
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <CarFront className="h-4 w-4 text-cyan-200" aria-hidden />
                    {totalRaces}/{maxRaces}
                  </span>
                </>
              )}
            </div>
          )}
          <Button
            type="button"
            size="lg"
            onClick={onStart}
            disabled={isLoading}
            className="h-14 w-full max-w-64 px-6 text-lg"
          >
            <Play className="h-5 w-5 fill-current" aria-hidden />
            {buttonLabel}
          </Button>
        </div>
      </div>
    </section>
  );
};

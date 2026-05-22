import { CarFront, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import startScreenBg from "@/assets/start-screen-bg.jpg";
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
      aria-label="Hop and Fill"
      className="absolute inset-0 z-[70] overflow-hidden bg-black text-white"
      data-testid="start-screen"
    >
      <img
        src={startScreenBg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        decoding="async"
        draggable={false}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_43%,transparent_0%,rgba(0,0,0,0.04)_40%,rgba(0,0,0,0.62)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#120804] via-[#120804]/74 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(2.25rem+env(safe-area-inset-bottom))]">
        <div className="flex w-full max-w-md flex-col items-center gap-3 px-4 py-4">
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
            className="h-14 min-w-56 px-8 text-lg"
          >
            <Play className="h-5 w-5 fill-current" aria-hidden />
            {buttonLabel}
          </Button>
        </div>
      </div>
    </section>
  );
};

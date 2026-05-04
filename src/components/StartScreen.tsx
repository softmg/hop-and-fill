import { CarFront, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import startScreenBg from "@/assets/start-screen-bg.jpg";

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
  const buttonLabel = isLoading ? "Загрузка..." : isFirstStart ? "Начать" : "Продолжить";

  return (
    <section
      aria-label="Стартовая страница"
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_0%,rgba(0,0,0,0.08)_42%,rgba(0,0,0,0.62)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black via-black/70 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(2.25rem+env(safe-area-inset-bottom))]">
        <div className="flex w-full max-w-md flex-col items-center gap-3">
          {!isLoading && !isFirstStart && (
            <div className="flex items-center gap-2 rounded-md border border-white/18 bg-black/58 px-3 py-1.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(0,0,0,0.45)] backdrop-blur">
              <span>Уровень {currentLevelNumber}</span>
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
            className="h-14 min-w-56 rounded-md border border-yellow-200/55 bg-yellow-300 px-8 text-lg font-black text-[#251505] shadow-[0_18px_40px_rgba(0,0,0,0.48),inset_0_-3px_0_rgba(120,53,15,0.25)] hover:bg-yellow-200"
          >
            <Play className="h-5 w-5 fill-current" aria-hidden />
            {buttonLabel}
          </Button>
        </div>
      </div>
    </section>
  );
};

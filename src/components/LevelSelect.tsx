import { CheckCircle2, Lock, Star, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LevelData } from "@/game/Level";
import {
  getBestStars,
  getTotalStars,
  isLevelUnlocked,
  type PlayerProgress,
} from "@/game/progress";

interface LevelSelectProps {
  open: boolean;
  levels: LevelData[];
  progress: PlayerProgress;
  currentLevelIndex: number;
  onClose: () => void;
  onSelectLevel: (levelIndex: number) => void;
}

const emptyStars = [0, 1, 2];

export const LevelSelect = ({
  open,
  levels,
  progress,
  currentLevelIndex,
  onClose,
  onSelectLevel,
}: LevelSelectProps) => {
  if (!open) return null;

  const totalStars = getTotalStars(progress);
  const maxStars = levels.length * 3;
  const completedCount = progress.completedLevels.length;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/75 px-3 py-5 backdrop-blur-md">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-select-title"
        className="w-full max-w-3xl rounded-lg border border-white/[0.15] bg-black/[0.72] p-4 text-white shadow-2xl sm:p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/[0.65]">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1">
                <Trophy className="h-3.5 w-3.5 text-yellow-300" aria-hidden />
                {totalStars}/{maxStars}
              </span>
              <span className="rounded-md bg-white/10 px-2 py-1">
                {completedCount}/{levels.length} пройдено
              </span>
            </div>
            <h2 id="level-select-title" className="mt-2 text-xl font-bold sm:text-2xl">
              Выбор уровня
            </h2>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-9 w-9 shrink-0 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            aria-label="Закрыть выбор уровня"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="grid max-h-[64vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
          {levels.map((level, index) => {
            const levelNumber = index + 1;
            const unlocked = isLevelUnlocked(progress, index);
            const completed = progress.completedLevels.includes(levelNumber);
            const stars = getBestStars(progress, index);
            const selected = currentLevelIndex === index;

            return (
              <button
                key={`${levelNumber}-${level.name}`}
                type="button"
                disabled={!unlocked}
                onClick={() => onSelectLevel(index)}
                className={cn(
                  "min-h-24 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300",
                  "disabled:cursor-not-allowed disabled:opacity-[0.55]",
                  selected
                    ? "border-yellow-300 bg-yellow-300/[0.18] shadow-[0_0_0_1px_rgba(253,224,71,0.35)]"
                    : "border-white/[0.12] bg-white/[0.09] hover:border-white/[0.35] hover:bg-white/[0.14]",
                  !unlocked && "bg-white/5 hover:border-white/[0.12] hover:bg-white/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white/[0.65]">#{levelNumber}</span>
                  {unlocked ? (
                    completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-white/30" aria-hidden />
                    )
                  ) : (
                    <Lock className="h-4 w-4 text-white/[0.45]" aria-hidden />
                  )}
                </div>
                <div className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">
                  {level.name}
                </div>
                <div className="mt-3 flex items-center gap-0.5" aria-label={`${stars} из 3 звезд`}>
                  {emptyStars.map((slot) => (
                    <Star
                      key={slot}
                      className={cn(
                        "h-4 w-4",
                        stars > slot ? "fill-yellow-300 text-yellow-300" : "text-white/25",
                      )}
                      aria-hidden
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

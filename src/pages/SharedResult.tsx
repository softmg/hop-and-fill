import { Link } from "react-router-dom";
import { AlertTriangle, CarFront, Clock3, Home, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParallaxBackground } from "@/components/ParallaxBackground";
import { decodeSharedResult } from "@/game/shareResult";
import { formatDurationMs } from "@/game/time";

interface SharedResultPageProps {
  token: string | null;
}

const ResultStars = ({ count }: { count: number }) => (
  <div className="flex justify-center gap-1" aria-label={`${count} из 3 звёзд`}>
    {[0, 1, 2].map((index) => (
      <Star
        key={index}
        className={`h-8 w-8 ${index < count ? "fill-yellow-300 text-yellow-300" : "fill-white/10 text-white/25"}`}
        aria-hidden
      />
    ))}
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="border-t border-white/10 py-3 first:border-t-0">
    <div className="text-xs font-semibold uppercase text-white/45">{label}</div>
    <div className="mt-1 text-lg font-black leading-tight text-white">{value}</div>
  </div>
);

export const SharedResultPage = ({ token }: SharedResultPageProps) => {
  const result = decodeSharedResult(token);

  return (
    <main className="relative min-h-screen w-screen overflow-hidden bg-background text-white">
      <div className="absolute inset-0">
        <ParallaxBackground theme={result?.kind === "final" ? "neon" : "default"} />
      </div>
      <section className="relative z-10 flex min-h-screen items-center justify-center overflow-y-auto px-4 py-6">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-black/[0.76] p-5 text-center shadow-2xl ring-1 ring-white/10 backdrop-blur-md sm:p-6">
          {!result ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-400/15 ring-1 ring-red-200/25">
                <AlertTriangle className="h-6 w-6 text-red-100" aria-hidden />
              </div>
              <h1 className="mt-4 text-2xl font-black">Ссылка не открылась</h1>
              <p className="mt-3 text-sm text-white/70">
                Данные результата повреждены или ссылка была обрезана.
              </p>
              <Button asChild className="mt-5 w-full">
                <Link to="/">
                  <Home className="h-4 w-4" aria-hidden />
                  Играть
                </Link>
              </Button>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-300/20 ring-1 ring-yellow-300/30">
                <Trophy className="h-6 w-6 text-yellow-300" aria-hidden />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                Hop &amp; Fill
              </p>
              <h1 className="mt-2 text-2xl font-black">
                {result.kind === "final"
                  ? "Финальный результат"
                  : result.level
                    ? `Уровень ${result.level.number} пройден`
                    : "Результат игрока"}
              </h1>

              {result.level && (
                <div className="mt-4">
                  <div className="text-sm font-semibold text-white/75">{result.level.name}</div>
                  <div className="mt-3">
                    <ResultStars count={result.level.stars} />
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-white/70">
                    <span className="rounded-md bg-white/[0.08] px-2.5 py-1">
                      Ходы: {result.level.hops} / {result.level.optimalMoves}
                    </span>
                    {result.level.timeMs !== null && (
                      <span className="rounded-md bg-white/[0.08] px-2.5 py-1">
                        Время: {formatDurationMs(result.level.timeMs)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-left">
                <Stat label="Уровни" value={`${result.completedLevels}/${result.levelCount}`} />
                <Stat label="Звёзды" value={`${result.totalStars}/${result.maxStars}`} />
                {result.maxRaces > 0 && <Stat label="Гонки" value={`${result.totalRaces}/${result.maxRaces}`} />}
                <Stat
                  label="Лучшее суммарное время"
                  value={result.totalBestTimeMs === null ? "—" : formatDurationMs(result.totalBestTimeMs)}
                />
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link to="/">
                    <Home className="h-4 w-4" aria-hidden />
                    Играть
                  </Link>
                </Button>
              </div>

              <div className="mt-4 flex items-center justify-center gap-3 text-xs text-white/50">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" aria-hidden />
                  {result.totalStars}
                </span>
                {result.maxRaces > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <CarFront className="h-3.5 w-3.5 text-cyan-200" aria-hidden />
                    {result.totalRaces}
                  </span>
                )}
                {result.totalBestTimeMs !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    {formatDurationMs(result.totalBestTimeMs)}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
};

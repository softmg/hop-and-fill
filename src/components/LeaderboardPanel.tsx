import { CircleAlert, Clock3, Loader2, RefreshCw, Save, Star, Trophy, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDurationMs } from "@/game/time";
import type { LeaderboardRow } from "@/game/leaderboard";

type LeaderboardStatus = "idle" | "loading" | "ready" | "error";
type LeaderboardSaveStatus = "idle" | "saving" | "saved" | "error" | "skipped";

interface LeaderboardPanelProps {
  open: boolean;
  currentScore: number;
  maxScore: number;
  entries: LeaderboardRow[];
  userRank: number | null;
  status: LeaderboardStatus;
  saveStatus: LeaderboardSaveStatus;
  onClose: () => void;
  onRefresh: () => void;
  onSave: () => void;
}

const getSaveStatusLabel = (status: LeaderboardSaveStatus) => {
  switch (status) {
    case "saving":
      return "Сохранение...";
    case "saved":
      return "Результат сохранён";
    case "error":
      return "Не сохранено";
    default:
      return "Готов к сохранению";
  }
};

const getRankClassName = (rank: number) => {
  if (rank === 1) return "border-[#ffe27a] bg-[#ffd34f] text-[#1d1106]";
  if (rank === 2) return "border-[#d7e7ff] bg-[#dce8f8] text-[#162132]";
  if (rank === 3) return "border-[#ffc187] bg-[#d99153] text-[#1d1106]";
  return "border-white/14 bg-white/8 text-white/82";
};

export const LeaderboardPanel = ({
  open,
  currentScore,
  maxScore,
  entries,
  userRank,
  status,
  saveStatus,
  onClose,
  onRefresh,
  onSave,
}: LeaderboardPanelProps) => {
  if (!open) return null;

  const canSave = currentScore > 0 && saveStatus !== "saving";
  const isLoading = status === "loading";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#110c08]/82 px-[max(0.5rem,env(safe-area-inset-left))] py-[calc(0.5rem_+_env(safe-area-inset-top))] backdrop-blur-[2px] sm:px-[max(1rem,env(safe-area-inset-left))]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        className="game-panel relative flex h-[min(88svh,42rem)] max-h-[calc(100svh_-_1rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-2xl min-w-0 flex-col overflow-hidden text-white"
      >
        <div className="relative z-10 flex min-w-0 items-center justify-between gap-2 border-b-[3px] border-[#6b3716]/75 bg-[linear-gradient(180deg,rgba(92,52,24,0.92),rgba(36,20,10,0.92))] px-2 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="game-hud-chip flex h-10 w-10 min-w-10 shrink-0 items-center justify-center">
              <Trophy className="h-5 w-5 text-[#ffd35f]" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="leaderboard-title" className="game-title truncate text-xl leading-none sm:text-3xl">
                Лидеры
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#f6d9a6]/78">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Star className="h-3.5 w-3.5 fill-[#ffcc45] text-[#ffcc45]" aria-hidden />
                  {currentScore}/{maxScore}
                </span>
                <span className="text-white/28">/</span>
                <span>{userRank ? `место ${userRank}` : getSaveStatusLabel(saveStatus)}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-10 w-10"
              aria-label="Обновить лидеров"
              title="Обновить"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-10 w-10"
              aria-label="Закрыть лидеров"
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="relative z-10 grid gap-2 border-b-[3px] border-[#6b3716]/50 bg-[radial-gradient(circle_at_24%_0%,rgba(255,204,69,0.18),transparent_34%),linear-gradient(180deg,rgba(58,34,14,0.62),rgba(14,9,6,0.88))] px-2 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3 sm:px-5 sm:py-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="game-stat-cell px-3 py-2">
              <div className="text-xs font-semibold text-white/52">Мой результат</div>
              <div className="mt-1 text-lg font-black tabular-nums text-[#ffe0a0]">{currentScore} ★</div>
            </div>
            <div className="game-stat-cell px-3 py-2">
              <div className="text-xs font-semibold text-white/52">Место</div>
              <div className="mt-1 text-lg font-black tabular-nums text-white">{userRank ?? "-"}</div>
            </div>
          </div>
          <Button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="h-10 min-w-0 px-3"
          >
            {saveStatus === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
            {saveStatus === "saving" ? "Сохраняем" : "Сохранить результат"}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,#150e09,#080504)] px-3 py-3 sm:px-5">
          {status === "error" && (
            <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-white/72">
              <CircleAlert className="h-8 w-8 text-[#ffd35f]" aria-hidden />
              <div className="mt-3 text-sm font-semibold">Лидерборд недоступен</div>
            </div>
          )}

          {status !== "error" && entries.length === 0 && !isLoading && (
            <div className="flex h-full min-h-48 items-center justify-center text-center text-sm font-semibold text-white/62">
              Результатов пока нет
            </div>
          )}

          {isLoading && entries.length === 0 && (
            <div className="flex h-full min-h-48 items-center justify-center text-sm font-semibold text-white/62">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Загрузка...
            </div>
          )}

          {entries.length > 0 && (
            <ol className="space-y-2">
              {entries.map((entry) => (
                <li
                  key={`${entry.rank}-${entry.uniqueID ?? entry.publicName}`}
                  className={cn(
                    "grid min-h-16 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-[0.8rem] border-2 px-2 py-2 shadow-[0_5px_0_rgba(75,39,18,0.55),0_12px_20px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:gap-3 sm:px-3",
                    entry.isCurrentUser
                      ? "border-[#ffd35f]/48 bg-[#ffd35f]/12"
                      : "border-white/10 bg-white/[0.045]",
                  )}
                >
                  <div className={cn("game-map-node flex h-10 w-10 items-center justify-center border-2 text-sm font-black tabular-nums", getRankClassName(entry.rank))}>
                    {entry.rank}
                  </div>

                  <div className="flex min-w-0 items-center gap-2">
                    <div className="game-map-node flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border-2 border-white/10 bg-black/30">
                      {entry.avatarSrc ? (
                        <img src={entry.avatarSrc} alt="" className="h-full w-full object-cover" draggable={false} />
                      ) : (
                        <UserRound className="h-5 w-5 text-white/58" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-black text-white">{entry.publicName}</span>
                        {entry.isCurrentUser && (
                          <span className="shrink-0 rounded-sm bg-[#ffd35f]/18 px-1.5 py-0.5 text-[0.65rem] font-black uppercase text-[#ffe0a0]">
                            Вы
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-white/52">
                        {entry.completedLevels !== null && entry.levelCount !== null && (
                          <span className="tabular-nums">
                            {entry.completedLevels}/{entry.levelCount} уровней
                          </span>
                        )}
                        {entry.totalBestTimeMs !== null && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock3 className="h-3 w-3" aria-hidden />
                            {formatDurationMs(entry.totalBestTimeMs)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-lg font-black tabular-nums text-[#ffd35f]">
                    {entry.score} ★
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
};

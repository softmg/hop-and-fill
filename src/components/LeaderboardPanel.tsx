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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#110c08]/88 px-3 py-3 backdrop-blur-md sm:px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        className="flex h-[min(88svh,42rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[#e5b56e]/35 bg-[#120d09] text-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#e5b56e]/22 bg-black/32 px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#ffcf61]/45 bg-[#ffcf61]/13 shadow-[0_0_22px_rgba(255,207,97,0.2)]">
              <Trophy className="h-5 w-5 text-[#ffd35f]" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="leaderboard-title" className="truncate text-2xl font-black leading-none text-white sm:text-3xl">
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
              className="h-10 w-10 border border-[#d2a260]/35 bg-black/38 text-[#f4d8a4] hover:bg-[#26170d] hover:text-white"
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
              className="h-10 w-10 border border-[#d2a260]/35 bg-black/38 text-[#f4d8a4] hover:bg-[#26170d] hover:text-white"
              aria-label="Закрыть лидеров"
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-[#e5b56e]/18 bg-[radial-gradient(circle_at_24%_0%,rgba(255,204,69,0.18),transparent_34%),linear-gradient(180deg,rgba(58,34,14,0.62),rgba(14,9,6,0.88))] px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-xs font-semibold text-white/52">Мой результат</div>
              <div className="mt-1 text-lg font-black tabular-nums text-[#ffe0a0]">{currentScore} ★</div>
            </div>
            <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-xs font-semibold text-white/52">Место</div>
              <div className="mt-1 text-lg font-black tabular-nums text-white">{userRank ?? "-"}</div>
            </div>
          </div>
          <Button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="h-10 border border-[#ffd56f]/35 bg-[#ffd35f] px-3 font-black text-[#1d1106] hover:bg-[#ffe083]"
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
                    "grid min-h-16 grid-cols-[2.75rem_1fr_auto] items-center gap-3 rounded-lg border px-3 py-2 shadow-[0_10px_20px_rgba(0,0,0,0.24)]",
                    entry.isCurrentUser
                      ? "border-[#ffd35f]/48 bg-[#ffd35f]/12"
                      : "border-white/10 bg-white/[0.045]",
                  )}
                >
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-md border text-sm font-black tabular-nums", getRankClassName(entry.rank))}>
                    {entry.rank}
                  </div>

                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/30">
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

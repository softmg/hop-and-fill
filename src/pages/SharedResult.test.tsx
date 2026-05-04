import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createSharedResult, encodeSharedResult } from "@/game/shareResult";
import type { PlayerProgress } from "@/game/progress";
import { SharedResultPage } from "./SharedResult";

const progress: PlayerProgress = {
  version: 1,
  unlockedLevel: 2,
  completedLevels: [1],
  bestStarsByLevel: { 1: 3 },
  bestTimeMsByLevel: { 1: 1240 },
  hasStarted: true,
  tutorialComplete: true,
  audioMuted: false,
};

describe("SharedResultPage", () => {
  it("renders a decoded level result", () => {
    const token = encodeSharedResult(
      createSharedResult(progress, 25, {
        kind: "level",
        levelNumber: 1,
        levelName: "First Steps",
        stars: 3,
        hops: 8,
        optimalMoves: 8,
        timeMs: 1240,
      }),
    );

    render(
      <MemoryRouter>
        <SharedResultPage token={token} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Уровень 1 пройден" })).toBeInTheDocument();
    expect(screen.getByText("First Steps")).toBeInTheDocument();
    expect(screen.getByText("Ходы: 8 / 8")).toBeInTheDocument();
    expect(screen.getByText("Время: 0:01.2")).toBeInTheDocument();
    expect(screen.getByText("3/75")).toBeInTheDocument();
  });

  it("shows an invalid link state", () => {
    render(
      <MemoryRouter>
        <SharedResultPage token="broken" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Ссылка не открылась" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Играть" })).toHaveAttribute("href", "/");
  });
});

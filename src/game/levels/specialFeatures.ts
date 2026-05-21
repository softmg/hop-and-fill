import type { LevelCell, LevelData, TeleportPair } from "../Level.ts";

const NEIGHBOR_DIRECTIONS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

interface GraphCell extends LevelCell {
  key: string;
  index: number;
}

interface LevelGraph {
  cells: GraphCell[];
  cellIndexByKey: Map<string, number>;
  baseNeighbors: number[][];
  startIndex: number;
  distanceMatrix: number[][];
  centrality: number[];
  eccentricity: number[];
}

export interface RouteSolution {
  moves: number;
  route: LevelCell[];
}

export interface FeatureImpact {
  optimalRoute: RouteSolution | null;
  optimalRouteUsesTeleport: boolean;
  optimalRouteWithoutTeleports: RouteSolution | null;
  teleportRequiredForOptimal: boolean;
  shorterRouteWithoutFragileCells: RouteSolution | null;
  fragileCellsRaiseOptimal: boolean;
}

interface FeaturePlan {
  mOpt: number;
  fragileCells: LevelCell[];
  teleportPairs?: TeleportPair[];
}

interface SolveOptions {
  maxMoves: number;
  timeoutMs?: number;
  maxStates?: number;
  directBound?: boolean;
}

interface SearchGraph extends LevelGraph {
  neighbors: number[][];
  fragile: Set<number>;
}

export function cellKey(cell: LevelCell) {
  return `${cell.gx},${cell.gy}`;
}

function isBoardCell(level: Pick<LevelData, "rows">, cell: LevelCell) {
  const value = level.rows[cell.gy]?.[cell.gx];
  return value !== undefined && value !== "." && value !== " ";
}

function toGraph(level: Pick<LevelData, "rows">) {
  const cells: GraphCell[] = [];
  let startIndex = -1;

  for (let gy = 0; gy < level.rows.length; gy++) {
    for (let gx = 0; gx < level.rows[gy].length; gx++) {
      const cell = { gx, gy };
      if (!isBoardCell(level, cell)) continue;

      const index = cells.length;
      cells.push({ ...cell, key: cellKey(cell), index });
      if (level.rows[gy][gx] === "S") startIndex = index;
    }
  }

  const cellIndexByKey = new Map(cells.map((cell) => [cell.key, cell.index]));
  const baseNeighbors = cells.map((cell) =>
    NEIGHBOR_DIRECTIONS.map(([dx, dy]) => cellIndexByKey.get(cellKey({ gx: cell.gx + dx, gy: cell.gy + dy })))
      .filter((index): index is number => index !== undefined),
  );
  const distanceMatrix = cells.map((cell) => breadthFirstDistances(baseNeighbors, cell.index));
  const { centrality, eccentricity } = computeGraphScores(baseNeighbors, distanceMatrix);

  if (startIndex < 0) throw new Error("Level graph has no start cell.");

  return {
    cells,
    cellIndexByKey,
    baseNeighbors,
    startIndex,
    distanceMatrix,
    centrality,
    eccentricity,
  } satisfies LevelGraph;
}

function breadthFirstDistances(neighbors: number[][], start: number) {
  const distances = Array<number>(neighbors.length).fill(Number.POSITIVE_INFINITY);
  const queue = [start];
  distances[start] = 0;

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    for (const next of neighbors[current]) {
      if (Number.isFinite(distances[next])) continue;
      distances[next] = distances[current] + 1;
      queue.push(next);
    }
  }

  return distances;
}

/**
 * Scores cells by all-pairs shortest-path participation and graph eccentricity.
 */
function computeGraphScores(neighbors: number[][], distances: number[][]) {
  const centrality = Array<number>(neighbors.length).fill(0);
  const eccentricity = Array<number>(neighbors.length).fill(0);

  for (let from = 0; from < neighbors.length; from++) {
    for (let to = from + 1; to < neighbors.length; to++) {
      const shortest = distances[from][to];
      if (!Number.isFinite(shortest)) continue;

      eccentricity[from] = Math.max(eccentricity[from], shortest);
      eccentricity[to] = Math.max(eccentricity[to], shortest);

      for (let middle = 0; middle < neighbors.length; middle++) {
        if (middle === from || middle === to) continue;
        if (distances[from][middle] + distances[middle][to] === shortest) {
          centrality[middle] += 1;
        }
      }
    }
  }

  return { centrality, eccentricity };
}

function cloneNeighbors(neighbors: number[][]) {
  return neighbors.map((entries) => [...entries]);
}

function getSearchGraph(level: LevelData) {
  const graph = toGraph(level);
  const neighbors = cloneNeighbors(graph.baseNeighbors);

  for (const pair of level.teleportPairs ?? []) {
    const from = graph.cellIndexByKey.get(cellKey(pair.from));
    const to = graph.cellIndexByKey.get(cellKey(pair.to));
    if (from === undefined || to === undefined || from === to) continue;
    if (!neighbors[from].includes(to)) neighbors[from].push(to);
    if (!neighbors[to].includes(from)) neighbors[to].push(from);
  }

  const fragile = new Set(
    (level.fragileCells ?? [])
      .map((cell) => graph.cellIndexByKey.get(cellKey(cell)))
      .filter((index): index is number => index !== undefined),
  );

  return { ...graph, neighbors, fragile } satisfies SearchGraph;
}

function bitFor(index: number) {
  return 1n << BigInt(index);
}

function popCount(value: bigint) {
  let count = 0;
  while (value > 0n) {
    value &= value - 1n;
    count += 1;
  }
  return count;
}

function lowerBound(graph: SearchGraph) {
  // Painting every cell needs at least one move per non-start cell.
  // Leaf-based Euler bounds are not safe once the graph has cycles or teleport edges.
  return graph.cells.length - 1;
}

/**
 * Finds a shortest route that paints every tile and respects one-landing cells.
 */
export function solveOptimalRoute(level: LevelData, options: SolveOptions): RouteSolution | null {
  const graph = getSearchGraph(level);
  const allVisited = (1n << BigInt(graph.cells.length)) - 1n;
  const startMask = bitFor(graph.startIndex);
  const deadline = performance.now() + (options.timeoutMs ?? 1200);
  const maxStates = options.maxStates ?? 900_000;
  const route = [graph.startIndex];
  let states = 0;

  const findAtBound = (bound: number) => {
    const bestStepsByState = new Map<string, number>();

    const search = (at: number, visited: bigint, usedFragile: bigint, steps: number): boolean => {
      states += 1;
      if (states > maxStates || performance.now() > deadline) return false;
      if (visited === allVisited) return true;

      const unpaintedCount = graph.cells.length - popCount(visited);
      if (steps + unpaintedCount > bound) return false;

      const stateKey = `${at}|${visited.toString(36)}|${usedFragile.toString(36)}`;
      const bestSteps = bestStepsByState.get(stateKey);
      if (bestSteps !== undefined && bestSteps <= steps) return false;
      bestStepsByState.set(stateKey, steps);

      const choices = graph.neighbors[at]
        .filter((next) => !graph.fragile.has(next) || (usedFragile & bitFor(next)) === 0n)
        .map((next) => {
          const bit = bitFor(next);
          const isFresh = (visited & bit) === 0n;
          const freshNeighbors = graph.neighbors[next].filter((neighbor) => (visited & bitFor(neighbor)) === 0n).length;
          return { next, bit, isFresh, freshNeighbors, degree: graph.neighbors[next].length };
        })
        .sort(
          (a, b) =>
            Number(b.isFresh) - Number(a.isFresh) ||
            a.freshNeighbors - b.freshNeighbors ||
            a.degree - b.degree ||
            a.next - b.next,
        );

      for (const choice of choices) {
        route.push(choice.next);
        const nextFragile = graph.fragile.has(choice.next) ? usedFragile | choice.bit : usedFragile;
        if (search(choice.next, visited | choice.bit, nextFragile, steps + 1)) return true;
        route.pop();
      }

      return false;
    };

    return search(graph.startIndex, startMask, 0n, 0);
  };

  const firstBound = options.directBound ? options.maxMoves : lowerBound(graph);
  for (let bound = firstBound; bound <= options.maxMoves; bound++) {
    route.length = 1;
    if (!findAtBound(bound)) {
      if (states > maxStates || performance.now() > deadline) return null;
      continue;
    }

    return {
      moves: route.length - 1,
      route: route.map((index) => ({ gx: graph.cells[index].gx, gy: graph.cells[index].gy })),
    };
  }

  return null;
}

function cellsAreAdjacent(from: LevelCell, to: LevelCell) {
  const dx = Math.abs(from.gx - to.gx);
  const dy = Math.abs(from.gy - to.gy);
  return dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0);
}

function routeUsesTeleport(route: LevelCell[]) {
  for (let index = 1; index < route.length; index++) {
    if (!cellsAreAdjacent(route[index - 1], route[index])) return true;
  }
  return false;
}

/**
 * Compares the stated optimal route against the same board with teleports removed.
 */
export function assessFeatureImpact(level: LevelData, optimalMoves: number): FeatureImpact {
  const solveAtMoveLimit = (candidate: LevelData, maxMoves: number) => solveOptimalRoute(candidate, {
    maxMoves,
    timeoutMs: 1800,
    maxStates: 1_200_000,
    directBound: true,
  });

  const optimalRoute = solveAtMoveLimit(level, optimalMoves);
  const optimalRouteWithoutTeleports = level.teleportPairs?.length
    ? solveAtMoveLimit({ ...level, teleportPairs: undefined }, optimalMoves)
    : null;
  const shorterRouteWithoutFragileCells = level.fragileCells?.length && optimalMoves > 0
    ? solveAtMoveLimit({
        ...level,
        fragileCells: undefined,
      }, optimalMoves - 1)
    : null;

  return {
    optimalRoute,
    optimalRouteUsesTeleport: routeUsesTeleport(optimalRoute?.route ?? []),
    optimalRouteWithoutTeleports,
    teleportRequiredForOptimal: Boolean(level.teleportPairs?.length) && optimalRouteWithoutTeleports === null,
    shorterRouteWithoutFragileCells,
    fragileCellsRaiseOptimal: shorterRouteWithoutFragileCells !== null && shorterRouteWithoutFragileCells.moves < optimalMoves,
  };
}

function getFragileCandidateSets(graph: LevelGraph, count: number) {
  const candidates = graph.cells
    .filter((cell) => cell.index !== graph.startIndex && graph.baseNeighbors[cell.index].length >= 3)
    .map((cell) => ({
      cell,
      score:
        graph.centrality[cell.index] * 3 +
        graph.baseNeighbors[cell.index].length * 8 -
        graph.eccentricity[cell.index] * 2,
    }))
    .sort((a, b) => b.score - a.score || a.cell.index - b.cell.index)
    .slice(0, 12)
    .map(({ cell }) => cell);

  const sets: LevelCell[][] = [];
  const walk = (picked: GraphCell[], cursor: number) => {
    if (picked.length === count) {
      sets.push(picked.map(({ gx, gy }) => ({ gx, gy })));
      return;
    }

    for (let index = cursor; index < candidates.length && sets.length < 6; index++) {
      const candidate = candidates[index];
      if (picked.some((cell) => graph.distanceMatrix[cell.index][candidate.index] <= 1)) continue;
      walk([...picked, candidate], index + 1);
    }
  };

  walk([], 0);
  return sets;
}

function getTeleportCandidates(graph: LevelGraph, excludedCells: LevelCell[]) {
  const excluded = new Set(excludedCells.map(cellKey));
  const pairs: Array<{ pair: TeleportPair; score: number }> = [];

  for (let from = 0; from < graph.cells.length; from++) {
    const fromCell = graph.cells[from];
    if (excluded.has(fromCell.key) || graph.baseNeighbors[from].length < 2) continue;

    for (let to = from + 1; to < graph.cells.length; to++) {
      const toCell = graph.cells[to];
      if (excluded.has(toCell.key) || graph.baseNeighbors[to].length < 2) continue;

      const distance = graph.distanceMatrix[from][to];
      if (distance < 4) continue;

      pairs.push({
        pair: {
          from: { gx: fromCell.gx, gy: fromCell.gy },
          to: { gx: toCell.gx, gy: toCell.gy },
        },
        score:
          distance * 20 +
          graph.eccentricity[from] +
          graph.eccentricity[to] -
          Math.abs(graph.centrality[from] - graph.centrality[to]) * 0.02,
      });
    }
  }

  return pairs
    .sort((a, b) => b.score - a.score || cellKey(a.pair.from).localeCompare(cellKey(b.pair.from)))
    .slice(0, 5)
    .map(({ pair }) => pair);
}

function withOptimalScore(level: LevelData, solution: RouteSolution) {
  const oldThree = level.starThresholds?.threeStars ?? level.mOpt ?? solution.moves;
  const twoSlack = Math.max(2, (level.starThresholds?.twoStars ?? oldThree + 2) - oldThree);
  const oneSlack = Math.max(twoSlack + 2, (level.starThresholds?.oneStar ?? oldThree + 5) - oldThree);

  return {
    ...level,
    mOpt: solution.moves,
    starThresholds: {
      threeStars: solution.moves,
      twoStars: solution.moves + twoSlack,
      oneStar: solution.moves + oneSlack,
    },
  };
}

interface SolvedCandidate {
  level: LevelData;
  solution: RouteSolution;
  teleportRequiredForOptimal: boolean;
  optimalRouteUsesTeleport: boolean;
}

function solveFeatureCandidate(candidate: LevelData, maxMoves: number, options: Pick<SolveOptions, "timeoutMs" | "maxStates" | "directBound">) {
  const solution = solveOptimalRoute(candidate, {
    maxMoves,
    ...options,
  });
  if (!solution) return null;

  const impact = assessFeatureImpact(candidate, solution.moves);
  return {
    level: candidate,
    solution,
    teleportRequiredForOptimal: impact.teleportRequiredForOptimal,
    optimalRouteUsesTeleport: impact.optimalRouteUsesTeleport,
  } satisfies SolvedCandidate;
}

function chooseFeatureCandidate(candidates: SolvedCandidate[], chapter: number) {
  if (chapter >= 3) {
    return (
      candidates.find((candidate) => candidate.teleportRequiredForOptimal) ??
      candidates.find((candidate) => candidate.optimalRouteUsesTeleport) ??
      candidates[0]
    );
  }

  return candidates[0];
}

/**
 * Plans advanced chapter features with graph centrality and route validation.
 */
export function planChapterFeatures(level: LevelData): LevelData {
  if (level.chapter < 2) return level;

  const graph = toGraph(level);
  const desiredFragileCount = level.chapter >= 4 && graph.cells.length >= 48
    ? 3
    : graph.cells.length >= 34
      ? 2
      : 1;
  const maxMoves = (level.starThresholds?.oneStar ?? level.mOpt ?? graph.cells.length) + 12;

  const solvedCandidates: SolvedCandidate[] = [];

  for (let fragileCount = desiredFragileCount; fragileCount >= 1; fragileCount--) {
    for (const fragileCells of getFragileCandidateSets(graph, fragileCount)) {
      const teleportCandidates = level.chapter >= 3
        ? getTeleportCandidates(graph, fragileCells)
        : [undefined];

      for (const teleportPair of teleportCandidates) {
        const candidate = {
          ...level,
          fragileCells,
          teleportPairs: teleportPair ? [teleportPair] : undefined,
        };
        const solved = solveFeatureCandidate(candidate, maxMoves, {
          timeoutMs: 700,
          maxStates: 420_000,
        });
        if (!solved) continue;
        solvedCandidates.push(solved);
        const chosen = chooseFeatureCandidate(solvedCandidates, level.chapter);
        if (chosen.teleportRequiredForOptimal || level.chapter < 3) {
          return withOptimalScore(chosen.level, chosen.solution);
        }
      }
    }
  }

  for (const fragileCells of getFragileCandidateSets(graph, Math.min(2, desiredFragileCount))) {
    for (const teleportPair of level.chapter >= 3 ? getTeleportCandidates(graph, fragileCells) : [undefined]) {
      const candidate = {
        ...level,
        fragileCells,
        teleportPairs: teleportPair ? [teleportPair] : undefined,
      };
      const solved = solveFeatureCandidate(candidate, maxMoves, {
        timeoutMs: 900,
        maxStates: 650_000,
        directBound: true,
      });
      if (solved) solvedCandidates.push(solved);
    }
  }

  const chosen = chooseFeatureCandidate(solvedCandidates, level.chapter);
  if (chosen) return withOptimalScore(chosen.level, chosen.solution);

  throw new Error(`Unable to plan chapter features for level "${level.name}".`);
}

const SHIPPED_FEATURE_PLANS: Record<string, FeaturePlan> = {
  "Soft Reboot": { mOpt: 20, fragileCells: [{ gx: 5, gy: 2 }] },
  "Broken Bridge": { mOpt: 28, fragileCells: [{ gx: 5, gy: 3 }] },
  "Branching Labyrinth": { mOpt: 33, fragileCells: [{ gx: 2, gy: 5 }] },
  "Bent Orchard": { mOpt: 23, fragileCells: [{ gx: 3, gy: 4 }] },
  "Angled Pockets": { mOpt: 29, fragileCells: [{ gx: 3, gy: 2 }] },
  "Cracked Arcade": { mOpt: 34, fragileCells: [{ gx: 2, gy: 5 }, { gx: 3, gy: 3 }] },
  "Kite Junction": { mOpt: 37, fragileCells: [{ gx: 3, gy: 3 }, { gx: 1, gy: 3 }] },
  "Sawtooth Gate": {
    mOpt: 46,
    fragileCells: [{ gx: 2, gy: 6 }, { gx: 4, gy: 7 }],
    teleportPairs: [{ from: { gx: 0, gy: 0 }, to: { gx: 7, gy: 8 } }],
  },
  "Broken Switchbacks": {
    mOpt: 29,
    fragileCells: [{ gx: 1, gy: 5 }],
    teleportPairs: [{ from: { gx: 5, gy: 0 }, to: { gx: 9, gy: 5 } }],
  },
  "Hidden Spine": {
    mOpt: 29,
    fragileCells: [{ gx: 5, gy: 1 }],
    teleportPairs: [{ from: { gx: 2, gy: 3 }, to: { gx: 5, gy: 8 } }],
  },
  "Layered Passage": {
    mOpt: 41,
    fragileCells: [{ gx: 3, gy: 4 }, { gx: 2, gy: 6 }],
    teleportPairs: [{ from: { gx: 5, gy: 0 }, to: { gx: 0, gy: 8 } }],
  },
  "Skewed Garden": {
    mOpt: 44,
    fragileCells: [{ gx: 2, gy: 5 }, { gx: 5, gy: 2 }],
    teleportPairs: [{ from: { gx: 0, gy: 7 }, to: { gx: 7, gy: 7 } }],
  },
  "Deep Switchback": {
    mOpt: 43,
    fragileCells: [{ gx: 5, gy: 5 }, { gx: 4, gy: 2 }],
    teleportPairs: [{ from: { gx: 0, gy: 1 }, to: { gx: 8, gy: 7 } }],
  },
  "Gauntlet Return": {
    mOpt: 50,
    fragileCells: [{ gx: 5, gy: 2 }, { gx: 3, gy: 5 }],
    teleportPairs: [{ from: { gx: 9, gy: 0 }, to: { gx: 0, gy: 8 } }],
  },
  "Bent Gallery": {
    mOpt: 47,
    fragileCells: [{ gx: 4, gy: 4 }, { gx: 3, gy: 6 }, { gx: 2, gy: 4 }],
    teleportPairs: [{ from: { gx: 0, gy: 0 }, to: { gx: 7, gy: 1 } }],
  },
  "Branchlock Court": {
    mOpt: 53,
    fragileCells: [{ gx: 5, gy: 4 }, { gx: 5, gy: 2 }, { gx: 7, gy: 4 }],
    teleportPairs: [{ from: { gx: 3, gy: 2 }, to: { gx: 0, gy: 2 } }],
  },
  "Twinned Ridges": {
    mOpt: 57,
    fragileCells: [{ gx: 6, gy: 4 }, { gx: 4, gy: 6 }, { gx: 6, gy: 6 }],
    teleportPairs: [{ from: { gx: 7, gy: 0 }, to: { gx: 0, gy: 5 } }],
  },
  "Longhook Maze": {
    mOpt: 61,
    fragileCells: [{ gx: 5, gy: 5 }, { gx: 5, gy: 3 }, { gx: 7, gy: 5 }],
    teleportPairs: [{ from: { gx: 6, gy: 8 }, to: { gx: 8, gy: 3 } }],
  },
  "Bent Stronghold": {
    mOpt: 55,
    fragileCells: [{ gx: 6, gy: 4 }, { gx: 5, gy: 6 }],
    teleportPairs: [{ from: { gx: 1, gy: 8 }, to: { gx: 7, gy: 9 } }],
  },
  "Soft Drop": {
    mOpt: 32,
    fragileCells: [{ gx: 4, gy: 2 }],
    teleportPairs: [{ from: { gx: 0, gy: 3 }, to: { gx: 6, gy: 7 } }],
  },
  "Cutout Lane": {
    mOpt: 45,
    fragileCells: [{ gx: 5, gy: 2 }, { gx: 3, gy: 4 }],
    teleportPairs: [{ from: { gx: 2, gy: 0 }, to: { gx: 4, gy: 7 } }],
  },
  "Half-Moon Yard": {
    mOpt: 44,
    fragileCells: [{ gx: 5, gy: 3 }, { gx: 6, gy: 5 }],
    teleportPairs: [{ from: { gx: 0, gy: 2 }, to: { gx: 3, gy: 6 } }],
  },
  "Crooked Reservoir": {
    mOpt: 51,
    fragileCells: [{ gx: 5, gy: 5 }, { gx: 3, gy: 6 }],
    teleportPairs: [{ from: { gx: 6, gy: 0 }, to: { gx: 0, gy: 2 } }],
  },
  "Asymmetric Bastion": {
    mOpt: 64,
    fragileCells: [{ gx: 6, gy: 6 }, { gx: 4, gy: 4 }, { gx: 4, gy: 7 }],
    teleportPairs: [{ from: { gx: 2, gy: 0 }, to: { gx: 10, gy: 11 } }],
  },
  "Hooked Citadel": {
    mOpt: 70,
    fragileCells: [{ gx: 6, gy: 5 }, { gx: 3, gy: 5 }],
    teleportPairs: [{ from: { gx: 1, gy: 6 }, to: { gx: 9, gy: 5 } }],
  },
  "Broken Ramparts": {
    mOpt: 84,
    fragileCells: [{ gx: 7, gy: 7 }, { gx: 10, gy: 4 }],
    teleportPairs: [{ from: { gx: 7, gy: 9 }, to: { gx: 5, gy: 2 } }],
  },
  "Shifted Fortress": {
    mOpt: 90,
    fragileCells: [{ gx: 7, gy: 7 }, { gx: 9, gy: 5 }],
    teleportPairs: [{ from: { gx: 3, gy: 2 }, to: { gx: 12, gy: 5 } }],
  },
  "Square Route Crown": {
    mOpt: 85,
    fragileCells: [{ gx: 10, gy: 6 }, { gx: 2, gy: 2 }],
    teleportPairs: [{ from: { gx: 2, gy: 1 }, to: { gx: 10, gy: 11 } }],
  },
};

/**
 * Applies the graph-planned feature coordinates stored for shipped chapters.
 */
export function applyShippedFeaturePlan(level: LevelData): LevelData {
  const plan = SHIPPED_FEATURE_PLANS[level.name];
  if (!plan) return level;

  return withOptimalScore(
    {
      ...level,
      mOpt: plan.mOpt,
      fragileCells: plan.fragileCells,
      teleportPairs: plan.teleportPairs,
    },
    { moves: plan.mOpt, route: [] },
  );
}

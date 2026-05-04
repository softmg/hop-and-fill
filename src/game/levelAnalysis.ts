import type { LevelData } from "./Level.ts";

export interface ParsedLevelCell {
  gx: number;
  gy: number;
  isStart: boolean;
}

export interface ParsedLevelGraph {
  cells: ParsedLevelCell[];
  cellKeys: Set<string>;
  degreeByKey: Map<string, number>;
  startGx: number;
  startGy: number;
  startCellCount: number;
}

const NEIGHBOR_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

export function toCellKey(gx: number, gy: number) {
  return `${gx},${gy}`;
}

export function parseLevelGraph(level: Pick<LevelData, "rows">): ParsedLevelGraph {
  const cells: ParsedLevelCell[] = [];
  let startGx = 0;
  let startGy = 0;
  let startCellCount = 0;

  level.rows.forEach((row, gy) => {
    [...row].forEach((ch, gx) => {
      if (ch === "." || ch === " ") return;

      const isStart = ch === "S";
      cells.push({ gx, gy, isStart });

      if (isStart) {
        startGx = gx;
        startGy = gy;
        startCellCount += 1;
      }
    });
  });

  const cellKeys = new Set(cells.map((cell) => toCellKey(cell.gx, cell.gy)));
  const degreeByKey = new Map<string, number>();

  for (const cell of cells) {
    let degree = 0;
    for (const [dx, dy] of NEIGHBOR_DIRECTIONS) {
      if (cellKeys.has(toCellKey(cell.gx + dx, cell.gy + dy))) {
        degree += 1;
      }
    }
    degreeByKey.set(toCellKey(cell.gx, cell.gy), degree);
  }

  return {
    cells,
    cellKeys,
    degreeByKey,
    startGx,
    startGy,
    startCellCount,
  };
}

export function countDeadEnds(graph: ParsedLevelGraph) {
  let deadEnds = 0;
  for (const degree of graph.degreeByKey.values()) {
    if (degree === 1) deadEnds += 1;
  }
  return deadEnds;
}

export function countBranchingNodes(graph: ParsedLevelGraph) {
  let branchingNodes = 0;
  for (const degree of graph.degreeByKey.values()) {
    if (degree >= 3) branchingNodes += 1;
  }
  return branchingNodes;
}

export function getDistanceToNearestDeadEnd(graph: ParsedLevelGraph): number {
  const startKey = toCellKey(graph.startGx, graph.startGy);
  if (!graph.cellKeys.has(startKey)) return 0;
  if (countDeadEnds(graph) === 0) return 0;

  const visited = new Set<string>([startKey]);
  const queue: Array<{ key: string; gx: number; gy: number; dist: number }> = [
    { key: startKey, gx: graph.startGx, gy: graph.startGy, dist: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if ((graph.degreeByKey.get(current.key) ?? 0) === 1) {
      return current.dist;
    }

    for (const [dx, dy] of NEIGHBOR_DIRECTIONS) {
      const nextGx = current.gx + dx;
      const nextGy = current.gy + dy;
      const nextKey = toCellKey(nextGx, nextGy);
      if (!graph.cellKeys.has(nextKey) || visited.has(nextKey)) continue;

      visited.add(nextKey);
      queue.push({ key: nextKey, gx: nextGx, gy: nextGy, dist: current.dist + 1 });
    }
  }

  return 0;
}

function getShortestPathDistances(graph: ParsedLevelGraph, startKey: string) {
  const visited = new Set<string>([startKey]);
  const distances = new Map<string, number>([[startKey, 0]]);
  const queue: Array<{ key: string; gx: number; gy: number }> = [
    {
      key: startKey,
      gx: Number(startKey.split(",")[0]),
      gy: Number(startKey.split(",")[1]),
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDistance = distances.get(current.key) ?? 0;

    for (const [dx, dy] of NEIGHBOR_DIRECTIONS) {
      const nextGx = current.gx + dx;
      const nextGy = current.gy + dy;
      const nextKey = toCellKey(nextGx, nextGy);
      if (!graph.cellKeys.has(nextKey) || visited.has(nextKey)) continue;

      visited.add(nextKey);
      distances.set(nextKey, currentDistance + 1);
      queue.push({ key: nextKey, gx: nextGx, gy: nextGy });
    }
  }

  return distances;
}

export function computeGraphDiameter(graph: ParsedLevelGraph) {
  let diameter = 0;

  for (const cell of graph.cells) {
    const startKey = toCellKey(cell.gx, cell.gy);
    const distances = getShortestPathDistances(graph, startKey);

    for (const distance of distances.values()) {
      if (distance > diameter) diameter = distance;
    }
  }

  return diameter;
}

export interface LevelGraphMetrics {
  tileCount: number;
  deadEndCount: number;
  branchingCount: number;
  graphDiameter: number;
  startPenalty: number;
  startCellCount: number;
}

export function analyzeLevelGraph(level: Pick<LevelData, "rows">): LevelGraphMetrics {
  const graph = parseLevelGraph(level);

  return {
    tileCount: graph.cells.length,
    deadEndCount: countDeadEnds(graph),
    branchingCount: countBranchingNodes(graph),
    graphDiameter: computeGraphDiameter(graph),
    startPenalty: getDistanceToNearestDeadEnd(graph),
    startCellCount: graph.startCellCount,
  };
}

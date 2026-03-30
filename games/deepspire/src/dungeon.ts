import { randomInt } from "./rng.js";
import type { Cell, Enemy, Vec2 } from "./types.js";

const DEFAULT_W = 11;
const DEFAULT_H = 11;

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

function neighbors4(x: number, y: number): Vec2[] {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
}

/** Lista pól podłogi osiągalnych z start (BFS). */
function reachableFloors(
  grid: Cell[][],
  w: number,
  h: number,
  start: Vec2,
): Set<string> {
  const key = (a: Vec2) => `${a.x},${a.y}`;
  const seen = new Set<string>();
  const q: Vec2[] = [];
  if (!inBounds(start.x, start.y, w, h)) return seen;
  if (grid[start.y]![start.x] === "wall") return seen;
  seen.add(key(start));
  q.push(start);
  while (q.length) {
    const c = q.shift()!;
    for (const n of neighbors4(c.x, c.y)) {
      if (!inBounds(n.x, n.y, w, h)) continue;
      if (grid[n.y]![n.x] === "wall") continue;
      const k = key(n);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push(n);
    }
  }
  return seen;
}

function carveDrunkard(
  seed: number,
  startCounter: number,
  w: number,
  h: number,
): { grid: Cell[][]; path: Vec2[]; rngCounter: number } {
  const grid: Cell[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => "wall" as Cell));
  let cx = Math.floor(w / 2);
  let cy = Math.floor(h / 2);
  let c = startCounter;
  const path: Vec2[] = [];
  const steps = w * h * 2;
  for (let i = 0; i < steps; i++) {
    grid[cy]![cx] = "floor";
    path.push({ x: cx, y: cy });
    const r = randomInt(seed, c, 4);
    c = r.nextCounter;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;
    const [dx, dy] = dirs[r.value]!;
    const nx = Math.min(w - 2, Math.max(1, cx + dx));
    const ny = Math.min(h - 2, Math.max(1, cy + dy));
    cx = nx;
    cy = ny;
  }
  return { grid, path, rngCounter: c };
}

function pickDistinctFloors(
  seed: number,
  startCounter: number,
  candidates: Vec2[],
  count: number,
  avoid: Set<string>,
): { picked: Vec2[]; rngCounter: number } {
  const pool = candidates.filter((p) => !avoid.has(`${p.x},${p.y}`));
  let c = startCounter;
  const picked: Vec2[] = [];
  const used = new Set<string>([...avoid]);
  for (let k = 0; k < count && pool.length > 0; k++) {
    const r = randomInt(seed, c, pool.length);
    c = r.nextCounter;
    const p = pool.splice(r.value, 1)[0]!;
    const key = `${p.x},${p.y}`;
    if (used.has(key)) {
      k--;
      continue;
    }
    used.add(key);
    picked.push(p);
  }
  return { picked, rngCounter: c };
}

export interface FloorGenResult {
  grid: Cell[][];
  width: number;
  height: number;
  rngCounter: number;
  player: Vec2;
  stairs: Vec2;
  enemies: Enemy[];
}

/**
 * Generuje jedno piętro: pijany kopacz + schody + wrogowie.
 * Próbuje kolejnych liczników RNG aż powstanie sensowna mapa.
 */
export function generateFloor(
  seed: number,
  startCounter: number,
  depth: number,
): FloorGenResult {
  const w = DEFAULT_W;
  const h = DEFAULT_H;
  let attempt = 0;
  let c = startCounter;
  while (attempt < 80) {
    const carved = carveDrunkard(seed, c, w, h);
    c = carved.rngCounter + attempt;
    const start = carved.path[0] ?? { x: Math.floor(w / 2), y: Math.floor(h / 2) };
    const reach = reachableFloors(carved.grid, w, h, start);
    if (reach.size < 28) {
      attempt++;
      continue;
    }
    const floors: Vec2[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (carved.grid[y]![x] !== "wall" && reach.has(`${x},${y}`)) {
          floors.push({ x, y });
        }
      }
    }
    const avoidStart = new Set<string>([`${start.x},${start.y}`]);
    const stairPick = pickDistinctFloors(seed, c, floors, 1, avoidStart);
    c = stairPick.rngCounter;
    if (stairPick.picked.length < 1) {
      attempt++;
      continue;
    }
    const stairs = stairPick.picked[0]!;
    const grid = carved.grid.map((row) => [...row]);
    grid[stairs.y]![stairs.x] = "stairs";

    const enemyCount = Math.min(4, 1 + Math.floor(depth / 2) + (depth % 2));
    const avoid2 = new Set<string>([`${start.x},${start.y}`, `${stairs.x},${stairs.y}`]);
    const enPick = pickDistinctFloors(seed, c, floors, enemyCount, avoid2);
    c = enPick.rngCounter;
    const enemyHp = depth >= 3 ? 2 : 1;
    const enemies: Enemy[] = enPick.picked.map((pos, i) => ({
      id: `e${depth}-${i}`,
      x: pos.x,
      y: pos.y,
      hp: enemyHp,
    }));

    return {
      grid,
      width: w,
      height: h,
      rngCounter: c,
      player: { ...start },
      stairs: { ...stairs },
      enemies,
    };
  }
  throw new Error("generateFloor: failed to carve valid floor");
}

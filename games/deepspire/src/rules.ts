import { generateFloor } from "./dungeon.js";
import { randomInt } from "./rng.js";
import type { AIContext, Cell, Dir, Enemy, GameAction, GameState, PublicView, WinResult } from "./types.js";

const CONTENT_VERSION = "0.1.0";
const PLAYER_MAX_HP = 8;
const PLAYER_HIT_DAMAGE = 1;
const WIN_DEPTH = 3;

function dirDelta(d: Dir): { dx: number; dy: number } {
  switch (d) {
    case "N":
      return { dx: 0, dy: -1 };
    case "S":
      return { dx: 0, dy: 1 };
    case "E":
      return { dx: 1, dy: 0 };
    case "W":
      return { dx: -1, dy: 0 };
  }
}

function cellAt(s: GameState, x: number, y: number): Cell | undefined {
  return s.grid[y]?.[x];
}

function isWalkable(s: GameState, x: number, y: number): boolean {
  const c = cellAt(s, x, y);
  return c === "floor" || c === "stairs";
}

function enemyAt(s: GameState, x: number, y: number): Enemy | undefined {
  return s.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y);
}

function cloneGrid(g: Cell[][]): Cell[][] {
  return g.map((row) => [...row]);
}

export function createInitialState(seed: number): GameState {
  const floor = generateFloor(seed, 0, 1);
  return {
    genre: "roguelike",
    gameId: "deepspire",
    contentVersion: CONTENT_VERSION,
    turnIndex: 0,
    phase: "playing",
    activePlayerId: "hero",
    rngSeed: seed,
    rngCounter: floor.rngCounter,
    depth: 1,
    winDepth: WIN_DEPTH,
    width: floor.width,
    height: floor.height,
    grid: floor.grid,
    stairs: floor.stairs,
    player: {
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      x: floor.player.x,
      y: floor.player.y,
    },
    enemies: floor.enemies,
    history: [],
    terminal: null,
  };
}

export function checkWinCondition(state: GameState): WinResult {
  if (state.terminal) {
    return { status: "ended", outcome: state.terminal.outcome };
  }
  if (state.player.hp <= 0) {
    return { status: "ended", outcome: "death" };
  }
  return { status: "ongoing" };
}

function onStairs(s: GameState): boolean {
  return s.player.x === s.stairs.x && s.player.y === s.stairs.y;
}

export function getValidActions(state: GameState): GameAction[] {
  if (state.terminal || checkWinCondition(state).status === "ended") return [];
  const { x: px, y: py } = state.player;
  const actions: GameAction[] = [{ type: "WAIT" }];
  if (onStairs(state)) {
    actions.push({ type: "DESCEND" });
  }
  const dirs: Dir[] = ["N", "S", "E", "W"];
  for (const dir of dirs) {
    const { dx, dy } = dirDelta(dir);
    const tx = px + dx;
    const ty = py + dy;
    if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) continue;
    const targetEnemy = enemyAt(state, tx, ty);
    if (targetEnemy) {
      actions.push({ type: "MOVE", dir });
      continue;
    }
    if (isWalkable(state, tx, ty)) {
      actions.push({ type: "MOVE", dir });
    }
  }
  return actions;
}

function actOneEnemy(state: GameState, enemyId: string): GameState {
  const e = state.enemies.find((x) => x.id === enemyId && x.hp > 0);
  if (!e) return state;
  const { x: px, y: py } = state.player;
  const dx = px - e.x;
  const dy = py - e.y;
  const manhattan = Math.abs(dx) + Math.abs(dy);
  if (manhattan === 1) {
    return {
      ...state,
      player: { ...state.player, hp: state.player.hp - 1 },
    };
  }
  const opts: { x: number; y: number }[] = [];
  if (dx !== 0) opts.push({ x: e.x + Math.sign(dx), y: e.y });
  if (dy !== 0) opts.push({ x: e.x, y: e.y + Math.sign(dy) });
  if (Math.abs(dx) < Math.abs(dy)) opts.reverse();

  const blocked = (nx: number, ny: number) => {
    if (!isWalkable(state, nx, ny)) return true;
    if (nx === px && ny === py) return true;
    return state.enemies.some((o) => o.hp > 0 && o.id !== e.id && o.x === nx && o.y === ny);
  };

  for (const o of opts) {
    if (blocked(o.x, o.y)) continue;
    return {
      ...state,
      enemies: state.enemies.map((en) =>
        en.id === e.id ? { ...en, x: o.x, y: o.y } : en,
      ),
    };
  }
  return state;
}

function enemyPhase(state: GameState): GameState {
  const ids = [...new Set(state.enemies.filter((e) => e.hp > 0).map((e) => e.id))].sort((a, b) =>
    a.localeCompare(b),
  );
  let s = state;
  for (const id of ids) {
    s = actOneEnemy(s, id);
    if (s.player.hp <= 0) break;
  }
  return s;
}

function applyPlayerAction(state: GameState, action: GameAction): GameState {
  if (action.type === "WAIT") {
    return state;
  }
  if (action.type === "DESCEND") {
    if (!onStairs(state)) return state;
    if (state.depth === state.winDepth) {
      return { ...state, terminal: { outcome: "victory" } };
    }
    const nextDepth = state.depth + 1;
    const floor = generateFloor(state.rngSeed, state.rngCounter, nextDepth);
    return {
      ...state,
      depth: nextDepth,
      rngCounter: floor.rngCounter,
      width: floor.width,
      height: floor.height,
      grid: floor.grid,
      stairs: floor.stairs,
      player: {
        ...state.player,
        hp: state.player.maxHp,
        x: floor.player.x,
        y: floor.player.y,
      },
      enemies: floor.enemies,
      terminal: null,
    };
  }
  if (action.type === "MOVE") {
    const { dx, dy } = dirDelta(action.dir);
    const tx = state.player.x + dx;
    const ty = state.player.y + dy;
    const target = enemyAt(state, tx, ty);
    if (target) {
      const dmg = target.hp - PLAYER_HIT_DAMAGE;
      const enemies = state.enemies.map((en) =>
        en.id === target.id ? { ...en, hp: dmg } : en,
      );
      return { ...state, enemies };
    }
    if (isWalkable(state, tx, ty)) {
      return {
        ...state,
        player: { ...state.player, x: tx, y: ty },
      };
    }
  }
  return state;
}

export function applyAction(state: GameState, action: GameAction): GameState {
  if (state.terminal) return state;
  const valid = getValidActions(state);
  const ok = valid.some((a) => actionsEqual(a, action));
  if (!ok) return state;

  let next = applyPlayerAction(state, action);
  if (next.terminal?.outcome === "victory") {
    const entry = { turnIndex: state.turnIndex, action };
    return {
      ...next,
      turnIndex: state.turnIndex + 1,
      history: [...state.history, entry],
    };
  }
  next = enemyPhase(next);
  let terminal = next.terminal;
  if (next.player.hp <= 0) {
    terminal = { outcome: "death" };
  }
  const entry = { turnIndex: state.turnIndex, action };
  return {
    ...next,
    turnIndex: state.turnIndex + 1,
    history: [...state.history, entry],
    terminal,
  };
}

export function actionsEqual(a: GameAction, b: GameAction): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "MOVE" && b.type === "MOVE") return a.dir === b.dir;
  return true;
}

export function getVisibility(state: GameState, _playerId: "hero"): PublicView {
  return {
    depth: state.depth,
    winDepth: state.winDepth,
    turnIndex: state.turnIndex,
    width: state.width,
    height: state.height,
    grid: cloneGrid(state.grid),
    stairs: { ...state.stairs },
    player: { ...state.player },
    enemies: state.enemies.map((e) => ({ ...e })),
  };
}

export function getAIContext(state: GameState): AIContext {
  const acts = getValidActions(state);
  const alive = state.enemies.filter((e) => e.hp > 0).length;
  return {
    genre: state.genre,
    gameId: state.gameId,
    turnIndex: state.turnIndex,
    depth: state.depth,
    playerHp: state.player.hp,
    enemyCount: alive,
    summary: `depth ${state.depth}/${state.winDepth} hp=${state.player.hp} enemies=${alive}`,
    validActionCount: acts.length,
  };
}

/** Prosty bot: ucieka gdy mało HP, w przeciwnym razie idzie w stronę schodów lub czeka. */
export function pickSimpleBotAction(state: GameState): GameAction {
  const acts = getValidActions(state);
  if (acts.length === 0) return { type: "WAIT" };
  const r = randomInt(state.rngSeed, state.rngCounter + state.turnIndex, acts.length);
  const descend = acts.find((a) => a.type === "DESCEND");
  /** Na polu schodów każdy MOVE oddala od celu — bez tego bot „tańczy” zamiast zejść. */
  if (descend) return descend;
  const dirs: Dir[] = ["N", "S", "E", "W"];
  const { x: px, y: py } = state.player;
  const { x: sx, y: sy } = state.stairs;
  let best: GameAction | undefined;
  let bestDist = Infinity;
  for (const dir of dirs) {
    const a: GameAction = { type: "MOVE", dir };
    if (!acts.some((x) => actionsEqual(x, a))) continue;
    const { dx, dy } = dirDelta(dir);
    const tx = px + dx;
    const ty = py + dy;
    if (enemyAt(state, tx, ty)) continue;
    const d = Math.abs(tx - sx) + Math.abs(ty - sy);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  if (best) return best;
  const attack = acts.find((a) => a.type === "MOVE");
  if (attack) return attack;
  return acts[r.value]!;
}

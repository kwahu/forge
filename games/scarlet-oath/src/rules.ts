import { randomInt } from "./rng.js";
import type {
  AIContext,
  Dir,
  GameAction,
  GameState,
  PlayerId,
  PublicView,
  UnitState,
  Vec2,
  WinResult,
} from "./types.js";

export const AP_PER_TURN = 3;
export const STRIKE_COST = 2;
export const MOVE_COST = 1;
export const DASH_COST = 2;
export const WARD_COST = 1;
export const STRIKE_DAMAGE = 5;
export const WARD_GAIN = 4;
export const MAX_SHIELD = 10;

const GRID_W = 6;
const GRID_H = 5;

const DELTA: Record<Dir, Vec2> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};

function opponentOf(p: PlayerId): PlayerId {
  return p === "p0" ? "p1" : "p0";
}

function inBounds(g: { width: number; height: number }, pos: Vec2): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < g.width && pos.y < g.height;
}

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function occupiedBy(state: GameState, pos: Vec2, except?: PlayerId): PlayerId | undefined {
  for (const pid of ["p0", "p1"] as const) {
    if (except === pid) continue;
    const p = state.positions[pid];
    if (p.x === pos.x && p.y === pos.y) return pid;
  }
  return undefined;
}

function applyDamage(unit: UnitState, amount: number): UnitState {
  let shield = unit.shield;
  let hp = unit.hp;
  let dmg = amount;
  const absorb = Math.min(shield, dmg);
  shield -= absorb;
  dmg -= absorb;
  hp -= dmg;
  return { ...unit, hp: Math.max(0, hp), shield };
}

/** Losuje, kto zaczyna (deterministycznie od seed). */
export function createInitialState(seed: number): GameState {
  const ini = randomInt(seed, 0, 2);
  const first: PlayerId = ini.value === 0 ? "p0" : "p1";
  const counter = ini.nextCounter;

  const units: GameState["units"] = {
    p0: { hp: 22, maxHp: 22, ap: first === "p0" ? AP_PER_TURN : 0, shield: 0 },
    p1: { hp: 22, maxHp: 22, ap: first === "p1" ? AP_PER_TURN : 0, shield: 0 },
  };

  return {
    genre: "rpg",
    gameId: "scarlet-oath",
    contentVersion: "0.2.0",
    turnIndex: 0,
    activePlayerId: first,
    phase: "tactics",
    rngSeed: seed,
    rngCounter: counter,
    grid: { width: GRID_W, height: GRID_H },
    positions: {
      p0: { x: 1, y: 2 },
      p1: { x: 4, y: 2 },
    },
    units,
    history: [],
  };
}

export function checkWinCondition(state: GameState): WinResult {
  if (state.units.p0.hp <= 0 && state.units.p1.hp <= 0) {
    return { status: "ended", winner: state.activePlayerId };
  }
  if (state.units.p0.hp <= 0) return { status: "ended", winner: "p1" };
  if (state.units.p1.hp <= 0) return { status: "ended", winner: "p0" };
  return { status: "ongoing" };
}

function isOrthAdjacent(a: Vec2, b: Vec2): boolean {
  return manhattan(a, b) === 1;
}

export function getValidActions(state: GameState): GameAction[] {
  if (checkWinCondition(state).status === "ended") return [];
  const pid = state.activePlayerId;
  const u = state.units[pid];
  const pos = state.positions[pid];
  const opp = opponentOf(pid);
  const oppPos = state.positions[opp];

  const actions: GameAction[] = [];
  const dirs: Dir[] = ["n", "e", "s", "w"];

  if (u.ap >= WARD_COST && u.shield < MAX_SHIELD) {
    actions.push({ type: "WARD" });
  }

  if (u.ap >= MOVE_COST) {
    for (const dir of dirs) {
      const next = add(pos, DELTA[dir]);
      if (!inBounds(state.grid, next)) continue;
      if (occupiedBy(state, next, pid) !== undefined) continue;
      actions.push({ type: "MOVE", dir });
    }
  }

  if (u.ap >= DASH_COST) {
    for (const dir of dirs) {
      const mid = add(pos, DELTA[dir]);
      const dest = add(mid, DELTA[dir]);
      if (!inBounds(state.grid, mid)) continue;
      if (!inBounds(state.grid, dest)) continue;
      if (occupiedBy(state, dest, pid) !== undefined) continue;
      actions.push({ type: "DASH", dir });
    }
  }

  if (u.ap >= STRIKE_COST && isOrthAdjacent(pos, oppPos)) {
    actions.push({ type: "STRIKE" });
  }

  actions.push({ type: "END_TURN" });
  return actions;
}

export function applyAction(state: GameState, action: GameAction): GameState {
  if (checkWinCondition(state).status === "ended") return state;

  const pid = state.activePlayerId;
  const u = state.units[pid];
  const pos = state.positions[pid];
  const opp = opponentOf(pid);

  let nextState: GameState = state;

  if (action.type === "END_TURN") {
    const refreshed: GameState["units"] = {
      ...state.units,
      [pid]: { ...state.units[pid], ap: 0 },
      [opp]: { ...state.units[opp], ap: AP_PER_TURN },
    };
    nextState = {
      ...state,
      activePlayerId: opp,
      turnIndex: state.turnIndex + 1,
      units: refreshed,
    };
  } else if (action.type === "WARD") {
    if (u.ap < WARD_COST || u.shield >= MAX_SHIELD) return state;
    nextState = {
      ...state,
      units: {
        ...state.units,
        [pid]: {
          ...u,
          ap: u.ap - WARD_COST,
          shield: Math.min(MAX_SHIELD, u.shield + WARD_GAIN),
        },
      },
    };
  } else if (action.type === "MOVE") {
    if (u.ap < MOVE_COST) return state;
    const dest = add(pos, DELTA[action.dir]);
    if (!inBounds(state.grid, dest)) return state;
    if (occupiedBy(state, dest, pid) !== undefined) return state;
    nextState = {
      ...state,
      positions: { ...state.positions, [pid]: dest },
      units: {
        ...state.units,
        [pid]: { ...u, ap: u.ap - MOVE_COST },
      },
    };
  } else if (action.type === "DASH") {
    if (u.ap < DASH_COST) return state;
    const mid = add(pos, DELTA[action.dir]);
    const dest = add(mid, DELTA[action.dir]);
    if (!inBounds(state.grid, mid)) return state;
    if (!inBounds(state.grid, dest)) return state;
    if (occupiedBy(state, dest, pid) !== undefined) return state;
    nextState = {
      ...state,
      positions: { ...state.positions, [pid]: dest },
      units: {
        ...state.units,
        [pid]: { ...u, ap: u.ap - DASH_COST },
      },
    };
  } else if (action.type === "STRIKE") {
    if (u.ap < STRIKE_COST) return state;
    const oppPos = state.positions[opp];
    if (!isOrthAdjacent(pos, oppPos)) return state;
    const target = state.units[opp];
    const damaged = applyDamage(target, STRIKE_DAMAGE);
    nextState = {
      ...state,
      units: {
        ...state.units,
        [pid]: { ...u, ap: u.ap - STRIKE_COST },
        [opp]: damaged,
      },
    };
  }

  const entry = {
    turnIndex: state.turnIndex,
    activePlayerId: pid,
    action,
  };
  return {
    ...nextState,
    history: [...state.history, entry],
  };
}

export function getVisibility(state: GameState, viewer: PlayerId): PublicView {
  const opp = opponentOf(viewer);
  return {
    you: state.units[viewer],
    opponent: state.units[opp],
    yourPos: state.positions[viewer],
    oppPos: state.positions[opp],
    grid: state.grid,
    activePlayerId: state.activePlayerId,
    turnIndex: state.turnIndex,
  };
}

export function getAIContext(state: GameState): AIContext {
  const pid = state.activePlayerId;
  const opp = opponentOf(pid);
  const acts = getValidActions(state);
  const dist = manhattan(state.positions[pid], state.positions[opp]);
  return {
    genre: state.genre,
    gameId: state.gameId,
    activePlayerId: pid,
    turnIndex: state.turnIndex,
    validActionCount: acts.length,
    summary: `t${state.turnIndex} ${pid} AP=${state.units[pid].ap} vs HP ${state.units[opp].hp}/${state.units[opp].maxHp} dist=${dist}`,
    yourHp: state.units[pid].hp,
    oppHp: state.units[opp].hp,
    yourAp: state.units[pid].ap,
    yourShield: state.units[pid].shield,
    oppShield: state.units[opp].shield,
    manhattanToOpp: dist,
  };
}

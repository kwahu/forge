import { randomInt } from "./rng.js";
import type {
  AIContext,
  Cell,
  Dir,
  GameAction,
  GameState,
  PlayerId,
  PublicView,
  UnitSlot,
  UnitState,
  WinResult,
} from "./types.js";

const MAX_HP = 5;
const ATTACK_DAMAGE = 2;
const MAX_HALF_TURNS = 512;

/** Domyślny teren v0.2 — symetryczne filary, duszki startowe nie kolidują. */
export const DEFAULT_BLOCKED: Cell[] = [
  { x: 1, y: 1 },
  { x: 3, y: 3 },
];

function cellBlocked(blocked: Cell[], x: number, y: number): boolean {
  return blocked.some((c) => c.x === x && c.y === y);
}

const DIR_DELTA: Record<Dir, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
};

function opponentOf(p: PlayerId): PlayerId {
  return p === "p0" ? "p1" : "p0";
}

function livingUnits(units: UnitState[]): UnitState[] {
  return units.filter((u) => u.hp > 0);
}

function occupantAt(units: UnitState[], x: number, y: number): UnitState | undefined {
  return livingUnits(units).find((u) => u.x === x && u.y === y);
}

function getUnit(state: GameState, owner: PlayerId, slot: UnitSlot): UnitState | undefined {
  return state.units.find((u) => u.owner === owner && u.slot === slot);
}

/** Stan początkowy: 5×5, po 2 strzelcach na stronę, pierwszy gracz z seeda. */
export function createInitialState(seed: number): GameState {
  const ini = randomInt(seed, 0, 2);
  const first: PlayerId = ini.value === 0 ? "p0" : "p1";
  const units: UnitState[] = [
    { owner: "p0", slot: 0, x: 0, y: 0, hp: MAX_HP },
    { owner: "p0", slot: 1, x: 1, y: 0, hp: MAX_HP },
    { owner: "p1", slot: 0, x: 4, y: 4, hp: MAX_HP },
    { owner: "p1", slot: 1, x: 3, y: 4, hp: MAX_HP },
  ];
  return {
    genre: "strategy",
    gameId: "drift-front",
    contentVersion: "0.2.0",
    boardWidth: 5,
    boardHeight: 5,
    blocked: [...DEFAULT_BLOCKED],
    activePlayerId: first,
    halfTurnIndex: 0,
    rngSeed: seed,
    rngCounter: ini.nextCounter,
    units,
    history: [],
  };
}

export function checkWinCondition(state: GameState): WinResult {
  const p0 = livingUnits(state.units.filter((u) => u.owner === "p0"));
  const p1 = livingUnits(state.units.filter((u) => u.owner === "p1"));
  if (p0.length === 0 && p1.length === 0) {
    return { status: "ended", winner: state.activePlayerId };
  }
  if (p0.length === 0) return { status: "ended", winner: "p1" };
  if (p1.length === 0) return { status: "ended", winner: "p0" };
  if (state.halfTurnIndex >= MAX_HALF_TURNS) return { status: "ended", winner: null, reason: "draw" };
  return { status: "ongoing" };
}

function inBounds(state: GameState, x: number, y: number): boolean {
  return x >= 0 && x < state.boardWidth && y >= 0 && y < state.boardHeight;
}

export function getValidActions(state: GameState): GameAction[] {
  if (checkWinCondition(state).status !== "ongoing") return [];
  const pid = state.activePlayerId;
  const actions: GameAction[] = [];
  const dirs: Dir[] = ["N", "E", "S", "W"];

  for (const slot of [0, 1] as const) {
    const u = getUnit(state, pid, slot);
    if (!u || u.hp <= 0) continue;
    for (const dir of dirs) {
      const { dx, dy } = DIR_DELTA[dir];
      const nx = u.x + dx;
      const ny = u.y + dy;
      if (
        inBounds(state, nx, ny) &&
        !cellBlocked(state.blocked, nx, ny) &&
        !occupantAt(state.units, nx, ny)
      ) {
        actions.push({ type: "MOVE", slot, dir });
      }
      const target = occupantAt(state.units, nx, ny);
      if (target && target.owner !== pid) {
        actions.push({ type: "ATTACK", slot, dir });
      }
    }
  }
  return actions;
}

function replaceUnit(units: UnitState[], updated: UnitState): UnitState[] {
  return units.map((u) =>
    u.owner === updated.owner && u.slot === updated.slot ? updated : u,
  );
}

export function applyAction(state: GameState, action: GameAction): GameState {
  if (checkWinCondition(state).status !== "ongoing") return state;
  const valid = getValidActions(state);
  if (!valid.some((a) => actionsEqual(a, action))) return state;

  const pid = state.activePlayerId;
  const u = getUnit(state, pid, action.slot);
  if (!u || u.hp <= 0) return state;

  const { dx, dy } = DIR_DELTA[action.dir];
  const tx = u.x + dx;
  const ty = u.y + dy;

  let units = state.units;

  if (action.type === "MOVE") {
    const moved: UnitState = { ...u, x: tx, y: ty };
    units = replaceUnit(units, moved);
  } else {
    const target = occupantAt(units, tx, ty);
    if (!target || target.owner === pid) return state;
    const damaged: UnitState = { ...target, hp: target.hp - ATTACK_DAMAGE };
    units = replaceUnit(units, damaged);
  }

  const afterAct: GameState = {
    ...state,
    units,
    halfTurnIndex: state.halfTurnIndex + 1,
    activePlayerId: opponentOf(pid),
  };

  const w = checkWinCondition(afterAct);
  const entry = {
    halfTurnIndex: state.halfTurnIndex,
    activePlayerId: pid,
    action,
  };

  if (w.status === "ongoing") {
    return { ...afterAct, history: [...state.history, entry] };
  }

  const frozen: GameState = {
    ...afterAct,
    activePlayerId: pid,
    history: [...state.history, entry],
  };
  return frozen;
}

function actionsEqual(a: GameAction, b: GameAction): boolean {
  if (a.type !== b.type) return false;
  if (a.slot !== b.slot) return false;
  return a.dir === b.dir;
}

export function getVisibility(state: GameState, _playerId: PlayerId): PublicView {
  return {
    boardWidth: state.boardWidth,
    boardHeight: state.boardHeight,
    blocked: state.blocked.map((c) => ({ ...c })),
    units: state.units.map((u) => ({ ...u })),
    activePlayerId: state.activePlayerId,
    halfTurnIndex: state.halfTurnIndex,
  };
}

export function getAIContext(state: GameState, playerId: PlayerId): AIContext {
  const valid = getValidActions(state);
  const yours = state.units.filter((u) => u.owner === playerId);
  const theirs = state.units.filter((u) => u.owner !== playerId);
  const lines = [
    `Półtura ${state.halfTurnIndex}, aktywny: ${state.activePlayerId}`,
    `Plansza ${state.boardWidth}×${state.boardHeight}, zablokowane: ${state.blocked.map((c) => `(${c.x},${c.y})`).join(" ")}`,
    ...yours.map((u) => `Twoja jednostka ${u.slot}: (${u.x},${u.y}) HP ${u.hp}`),
    ...theirs.map((u) => `Wróg ${u.owner} ${u.slot}: (${u.x},${u.y}) HP ${u.hp}`),
    `Legalnych akcji: ${valid.length}`,
  ];
  return {
    genre: state.genre,
    gameId: state.gameId,
    activePlayerId: state.activePlayerId,
    halfTurnIndex: state.halfTurnIndex,
    validActionCount: valid.length,
    summary: lines.join("\n"),
    yourUnits: yours.map((u) => ({ ...u })),
    enemyUnits: theirs.map((u) => ({ ...u })),
  };
}

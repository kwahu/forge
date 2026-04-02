/**
 * Odtwarzanie deterministycznych sesji (golden replay / regresja FORGE).
 */
import { applyAction, checkWinCondition, createInitialState, getValidActions } from "./rules.js";
import type { GameAction, GameState, PlayerId } from "./types.js";

export function actionsEqual(a: GameAction, b: GameAction): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "MOVE" && b.type === "MOVE") return a.dir === b.dir;
  if (a.type === "DASH" && b.type === "DASH") return a.dir === b.dir;
  return true;
}

export function replayActions(seed: number, actions: readonly GameAction[]): GameState {
  let state = createInitialState(seed);
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    if (checkWinCondition(state).status === "ended") {
      throw new Error(`replay: gra już zakończona przed krokiem ${i}`);
    }
    const valid = getValidActions(state);
    if (!valid.some((v) => actionsEqual(v, action))) {
      throw new Error(`replay: nielegalna akcja w kroku ${i}: ${JSON.stringify(action)}`);
    }
    state = applyAction(state, action);
  }
  return state;
}

/** Sygnatura stanu do porównań w testach (bez historii / rngCounter). */
export function combatSnapshot(state: GameState): {
  contentVersion: string;
  turnIndex: number;
  activePlayerId: PlayerId;
  positions: GameState["positions"];
  p0: { hp: number; shield: number };
  p1: { hp: number; shield: number };
  outcome: WinLite;
} {
  const w = checkWinCondition(state);
  const outcome: WinLite =
    w.status === "ended" ? { status: "ended", winner: w.winner } : { status: "ongoing" };
  return {
    contentVersion: state.contentVersion,
    turnIndex: state.turnIndex,
    activePlayerId: state.activePlayerId,
    positions: {
      p0: { ...state.positions.p0 },
      p1: { ...state.positions.p1 },
    },
    p0: { hp: state.units.p0.hp, shield: state.units.p0.shield },
    p1: { hp: state.units.p1.hp, shield: state.units.p1.shield },
    outcome,
  };
}

type WinLite = { status: "ongoing" } | { status: "ended"; winner: PlayerId };

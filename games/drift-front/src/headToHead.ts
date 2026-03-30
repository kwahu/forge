import { applyAction, checkWinCondition, createInitialState, getValidActions } from "./rules.js";
import { pickBotAction, type BotStrategyId } from "./botStrategies.js";
import type { GameAction, GameState, PlayerId } from "./types.js";

function actionsEqual(a: GameAction, b: GameAction): boolean {
  if (a.type !== b.type) return false;
  if (a.slot !== b.slot) return false;
  return a.dir === b.dir;
}

export interface HeadToHeadResult {
  steps: number;
  winner: PlayerId | null;
  aborted: boolean;
}

/** Jedna partia: p0 używa `stratP0`, p1 — `stratP1`. */
export function playHeadToHead(
  seed: number,
  stratP0: BotStrategyId,
  stratP1: BotStrategyId,
  maxSteps = 25_000,
): HeadToHeadResult {
  const sim = seed * 0x1a2b3c4d;
  let state: GameState = createInitialState(seed);
  let step = 0;
  while (checkWinCondition(state).status === "ongoing" && step < maxSteps) {
    const me = state.activePlayerId;
    const strat = me === "p0" ? stratP0 : stratP1;
    const action = pickBotAction(state, step, me, sim, strat);
    const acts = getValidActions(state);
    if (!acts.some((x) => actionsEqual(x, action))) {
      throw new Error(`Illegal bot action (${strat}) seed=${seed} step=${step}`);
    }
    state = applyAction(state, action);
    step++;
  }
  const w = checkWinCondition(state);
  if (w.status !== "ended") return { steps: step, winner: null, aborted: true };
  return { steps: step, winner: w.winner, aborted: false };
}

export const MATRIX_STRATEGY_IDS = ["spike", "aggro", "turtle"] as const;
export type MatrixStrategyId = (typeof MATRIX_STRATEGY_IDS)[number];

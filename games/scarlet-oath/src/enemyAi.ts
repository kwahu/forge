/**
 * Heurystyka „taktyczna": STRIKE → ruch minimalizujący Manhattan do przeciwnika (MOVE lub DASH) → WARD → END_TURN.
 * Działa dla dowolnego aktywnego gracza (testy, symulacja p0 vs p1 z tą samą logiką).
 */
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  getValidActions,
} from "./rules.js";
import { actionsEqual } from "./replay.js";
import type { Dir, GameAction, GameState, PlayerId, Vec2 } from "./types.js";

function opponentOf(p: PlayerId): PlayerId {
  return p === "p0" ? "p1" : "p0";
}

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const DIR_RANK: Record<Dir, number> = { n: 0, e: 1, s: 2, w: 3 };

const DELTA: Record<Dir, Vec2> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};

/** Wybór akcji dla aktywnego gracza — greedy vs przeciwnik. */
export function pickGreedyAction(state: GameState): GameAction {
  const me = state.activePlayerId;
  const opp = opponentOf(me);
  const valid = getValidActions(state);
  const posMe = state.positions[me];
  const posOpp = state.positions[opp];

  const strike = valid.find((x) => x.type === "STRIKE");
  if (strike) return strike;

  // Zbierz wszystkie opcje ruchu (MOVE i DASH) i wybierz te, która minimalizuje dystans do przeciwnika.
  // Przy remisie dystansu preferuj MOVE (tanszy), potem nizszy DIR_RANK.
  type MoveOpt = { action: Extract<GameAction, { type: "MOVE" | "DASH" }>; dist: number; cost: number };
  const moveOpts: MoveOpt[] = [];

  for (const a of valid) {
    if (a.type === "MOVE") {
      const np = { x: posMe.x + DELTA[a.dir].x, y: posMe.y + DELTA[a.dir].y };
      moveOpts.push({ action: a, dist: manhattan(np, posOpp), cost: 1 });
    } else if (a.type === "DASH") {
      const np = {
        x: posMe.x + 2 * DELTA[a.dir].x,
        y: posMe.y + 2 * DELTA[a.dir].y,
      };
      moveOpts.push({ action: a, dist: manhattan(np, posOpp), cost: 2 });
    }
  }

  if (moveOpts.length > 0) {
    let best = moveOpts[0]!;
    for (const opt of moveOpts) {
      const isBetter =
        opt.dist < best.dist ||
        (opt.dist === best.dist && opt.cost < best.cost) ||
        (opt.dist === best.dist && opt.cost === best.cost && DIR_RANK[opt.action.dir] < DIR_RANK[best.action.dir]);
      if (isBetter) best = opt;
    }
    return best.action;
  }

  const ward = valid.find((x) => x.type === "WARD");
  if (ward) return ward;

  return { type: "END_TURN" };
}

export function simulateGreedyVersus(
  seed: number,
  maxSteps = 500,
): { steps: number; winner: PlayerId; aborted: boolean } {
  let state = createInitialState(seed);
  let step = 0;
  while (checkWinCondition(state).status === "ongoing" && step < maxSteps) {
    const action = pickGreedyAction(state);
    const acts = getValidActions(state);
    if (!acts.some((x) => actionsEqual(x, action))) {
      throw new Error(`Illegal greedy action at step ${step} for ${state.activePlayerId}`);
    }
    state = applyAction(state, action);
    step++;
  }
  const w = checkWinCondition(state);
  if (w.status !== "ended") return { steps: step, winner: "p0", aborted: true };
  return { steps: step, winner: w.winner, aborted: false };
}

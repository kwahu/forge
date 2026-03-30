/**
 * Uruchom: npm run simulate -- [--games=200] [--seed=1] [--p0=spike] [--p1=turtle]
 * Domyślnie: spike vs spike (długość partii + balans miejsc przy „mądrym” mirror).
 * Legacy losowy mirror (oba gracze): --p0=random --p1=random
 */
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  getValidActions,
} from "../src/rules.js";
import type { GameState } from "../src/types.js";
import { randomInt } from "../src/rng.js";
import { parseBotStrategyId, type BotStrategyId } from "../src/botStrategies.js";
import { playHeadToHead } from "../src/headToHead.js";

function parseArgs() {
  const out: { games: number; seed: number; p0: BotStrategyId; p1: BotStrategyId } = {
    games: 200,
    seed: 1,
    p0: "spike",
    p1: "spike",
  };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--games=(\d+)$/);
    if (m) out.games = Math.min(50_000, Math.max(1, parseInt(m[1], 10)));
    const s = a.match(/^--seed=(\d+)$/);
    if (s) out.seed = parseInt(s[1], 10);
    const p0m = a.match(/^--p0=(.+)$/);
    if (p0m) out.p0 = parseBotStrategyId(p0m[1], out.p0);
    const p1m = a.match(/^--p1=(.+)$/);
    if (p1m) out.p1 = parseBotStrategyId(p1m[1], out.p1);
  }
  return out;
}

function pickRandomAction(state: GameState, simSeed: number, step: number) {
  const acts = getValidActions(state);
  const { value } = randomInt(simSeed, step, acts.length);
  return acts[value]!;
}

function playOneMatchLegacyRandomBoth(matchSeed: number): { steps: number; winner: "p0" | "p1" } {
  let s = createInitialState(matchSeed);
  let step = 0;
  const simSeed = matchSeed * 0x1a2b3c4d;
  while (checkWinCondition(s).status === "ongoing" && step < 20_000) {
    s = applyAction(s, pickRandomAction(s, simSeed, step));
    step++;
  }
  const w = checkWinCondition(s);
  if (w.status !== "ended") throw new Error(`Brak zwycięzcy po ${step} krokach`);
  return { steps: step, winner: w.winner };
}

const { games, seed, p0, p1 } = parseArgs();
const useLegacyRandom = p0 === "random" && p1 === "random";

let p0w = 0;
let p1w = 0;
let totalSteps = 0;
for (let g = 0; g < games; g++) {
  const matchSeed = seed + g * 9973;
  const r = useLegacyRandom
    ? playOneMatchLegacyRandomBoth(matchSeed)
    : (() => {
        const h = playHeadToHead(matchSeed, p0, p1);
        if (h.aborted) throw new Error(`Partia przerwana seed=${matchSeed}`);
        return { steps: h.steps, winner: h.winner };
      })();
  totalSteps += r.steps;
  if (r.winner === "p0") p0w++;
  else p1w++;
}
const avg = totalSteps / games;
console.log(
  JSON.stringify(
    {
      games,
      baseSeed: seed,
      p0Strategy: p0,
      p1Strategy: p1,
      p0Wins: p0w,
      p1Wins: p1w,
      avgSteps: Math.round(avg * 10) / 10,
      contentVersion: "0.7.3",
    },
    null,
    2,
  ),
);

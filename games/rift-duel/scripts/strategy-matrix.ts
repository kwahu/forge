/**
 * Pełna macierz: każdy archetyp (bez random) vs każdy inny, po N partii na parę (różne seed).
 * Uruchom: npm run playtest:matrix
 */
import {
  MATRIX_STRATEGY_IDS,
  playHeadToHead,
  type MatrixStrategyId,
} from "../src/headToHead.js";

const GAMES_PER_PAIR = Number(process.env.RD_MATRIX_GAMES || 10);

type Cell = {
  p0: MatrixStrategyId;
  p1: MatrixStrategyId;
  games: number;
  p0Wins: number;
  avgSteps: number;
  aborted: number;
};

const cells: Cell[] = [];
let seedSeq = 10_000;

for (const a of MATRIX_STRATEGY_IDS) {
  for (const b of MATRIX_STRATEGY_IDS) {
    if (a === b) continue;
    let p0Wins = 0;
    let stepsSum = 0;
    let aborted = 0;
    for (let k = 0; k < GAMES_PER_PAIR; k++) {
      const seed = seedSeq++;
      const r = playHeadToHead(seed, a, b);
      stepsSum += r.steps;
      if (r.aborted) aborted++;
      else if (r.winner === "p0") p0Wins++;
    }
    cells.push({
      p0: a,
      p1: b,
      games: GAMES_PER_PAIR,
      p0Wins,
      avgSteps: Math.round((stepsSum / GAMES_PER_PAIR) * 10) / 10,
      aborted,
    });
  }
}

const strats = [...MATRIX_STRATEGY_IDS];
const wins = Object.fromEntries(strats.map((s) => [s, 0])) as Record<MatrixStrategyId, number>;
const played = Object.fromEntries(strats.map((s) => [s, 0])) as Record<MatrixStrategyId, number>;
const stepsAcc = Object.fromEntries(strats.map((s) => [s, 0])) as Record<MatrixStrategyId, number>;

for (const c of cells) {
  played[c.p0] += c.games;
  played[c.p1] += c.games;
  stepsAcc[c.p0] += c.avgSteps * c.games;
  stepsAcc[c.p1] += c.avgSteps * c.games;
  const p1Wins = c.games - c.aborted - c.p0Wins;
  wins[c.p0] += c.p0Wins;
  wins[c.p1] += p1Wins;
}

const overall = strats.map((s) => ({
  strategy: s,
  wins: wins[s],
  played: played[s],
  winRate: played[s] ? Math.round((wins[s] / played[s]) * 1000) / 1000 : 0,
  avgStepsWhenInvolved: played[s] ? Math.round((stepsAcc[s] / played[s]) * 10) / 10 : 0,
}));

const matrixWinRate: Record<string, Record<string, number>> = {};
for (const s of strats) matrixWinRate[s] = {};
for (const c of cells) {
  const rate = c.games - c.aborted > 0 ? c.p0Wins / (c.games - c.aborted) : 0;
  matrixWinRate[c.p0]![c.p1] = Math.round(rate * 1000) / 1000;
}

console.log(
  JSON.stringify(
    {
      gamesPerOrderedPair: GAMES_PER_PAIR,
      orderedPairs: MATRIX_STRATEGY_IDS.length * (MATRIX_STRATEGY_IDS.length - 1),
      totalGames: cells.reduce((s, c) => s + c.games, 0),
      matrixP0WinRate: matrixWinRate,
      cells,
      overall,
      contentVersion: "0.7.3",
    },
    null,
    2,
  ),
);

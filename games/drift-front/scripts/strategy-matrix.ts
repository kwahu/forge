/**
 * Macierz heurystyka vs heurystyka (FORGE §6.4) — bez `random` jako jedynego body testów.
 */
import { playHeadToHead, MATRIX_STRATEGY_IDS, type MatrixStrategyId } from "../src/headToHead.js";

const PAIRS = 24;
const baseSeed = Number(process.argv[2] ?? 1000);

const ids = [...MATRIX_STRATEGY_IDS];

function runPair(a: MatrixStrategyId, b: MatrixStrategyId): { aw: number; bw: number; draw: number } {
  let aw = 0;
  let bw = 0;
  let draw = 0;
  for (let i = 0; i < PAIRS; i++) {
    const seed = (baseSeed + i * 9973 + a.charCodeAt(0) * 31 + b.charCodeAt(0)) >>> 0;
    const r = playHeadToHead(seed, a, b);
    if (r.aborted) draw++;
    else if (r.winner === "p0") aw++;
    else if (r.winner === "p1") bw++;
    else draw++;
  }
  return { aw, bw, draw };
}

console.log(`Pary partii na matchup: ${PAIRS}, bazowy seed: ${baseSeed}\n`);

for (const a of ids) {
  for (const b of ids) {
    const { aw, bw, draw } = runPair(a, b);
    console.log(`${a} (p0) vs ${b} (p1): p0=${aw} p1=${bw} remis=${draw}`);
  }
}

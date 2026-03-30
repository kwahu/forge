/**
 * Krótki zestaw meczów archetyp vs archetyp (bez `random`).
 * Pełna macierz: `npm run playtest:matrix`.
 */
import { playHeadToHead, type MatrixStrategyId } from "../src/headToHead.js";

const schedule: { seed: number; p0: MatrixStrategyId; p1: MatrixStrategyId; label: string }[] = [
  { seed: 42, p0: "spike", p1: "turtle", label: "Spike vs Obrońca" },
  { seed: 43, p0: "turtle", p1: "spike", label: "Obrońca vs Spike" },
  { seed: 99, p0: "aggro", p1: "spike", label: "Agresor vs Spike" },
  { seed: 100, p0: "spike", p1: "aggro", label: "Spike vs Agresor" },
  { seed: 7, p0: "disruptor", p1: "timmy", label: "Kontrola vs Timmy" },
  { seed: 8, p0: "timmy", p1: "disruptor", label: "Timmy vs Kontrola" },
  { seed: 202, p0: "spike", p1: "disruptor", label: "Spike vs Kontrola" },
  { seed: 203, p0: "disruptor", p1: "spike", label: "Kontrola vs Spike" },
  { seed: 300, p0: "turtle", p1: "timmy", label: "Obrońca vs Timmy" },
  { seed: 301, p0: "timmy", p1: "turtle", label: "Timmy vs Obrońca" },
  { seed: 500, p0: "spike", p1: "aggro", label: "Spike vs Agresor" },
  { seed: 501, p0: "disruptor", p1: "turtle", label: "Kontrola vs Obrońca" },
];

const results = schedule.map((m) => {
  const r = playHeadToHead(m.seed, m.p0, m.p1);
  return { ...m, steps: r.steps, winner: r.winner, aborted: r.aborted };
});

const strats: MatrixStrategyId[] = ["spike", "aggro", "turtle", "disruptor", "timmy"];
const byStrat: Record<MatrixStrategyId, { wins: number; played: number; stepsSum: number }> = {
  spike: { wins: 0, played: 0, stepsSum: 0 },
  aggro: { wins: 0, played: 0, stepsSum: 0 },
  turtle: { wins: 0, played: 0, stepsSum: 0 },
  disruptor: { wins: 0, played: 0, stepsSum: 0 },
  timmy: { wins: 0, played: 0, stepsSum: 0 },
};

for (const row of results) {
  if (row.aborted) continue;
  for (const [pid, sid] of [
    ["p0", row.p0],
    ["p1", row.p1],
  ] as const) {
    const id = sid as MatrixStrategyId;
    byStrat[id].played += 1;
    byStrat[id].stepsSum += row.steps;
    if (row.winner === pid) byStrat[id].wins += 1;
  }
}

console.log(JSON.stringify({ matches: results, aggregate: byStrat }, null, 2));

/**
 * Generuje plik golden replay (greedy vs greedy) dla wskazanego seeda.
 * Uruchom: npx tsx scripts/write-golden-fixture.ts 42
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pickGreedyAction } from "../src/enemyAi.js";
import { applyAction, checkWinCondition, createInitialState, getValidActions } from "../src/rules.js";
import { actionsEqual, combatSnapshot } from "../src/replay.js";
import type { GameAction } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const seed = Number(process.argv[2] ?? 42);
if (!Number.isFinite(seed)) {
  console.error("Podaj liczbowy seed (np. 42).");
  process.exit(1);
}

const maxSteps = 20_000;
let state = createInitialState(seed);
const actions: GameAction[] = [];
let step = 0;
while (checkWinCondition(state).status === "ongoing" && step < maxSteps) {
  const a = pickGreedyAction(state);
  const valid = getValidActions(state);
  if (!valid.some((x) => actionsEqual(x, a))) {
    console.error("Błąd: greedy zwrócił nielegalną akcję");
    process.exit(1);
  }
  state = applyAction(state, a);
  actions.push(a);
  step++;
}

const end = checkWinCondition(state);
if (end.status !== "ended") {
  console.error("Partia nie zakończona w limicie kroków");
  process.exit(1);
}

const snap = combatSnapshot(state);
const fixture = {
  gameId: "scarlet-oath",
  contentVersion: snap.contentVersion,
  profile: "greedy-vs-greedy",
  seed,
  actions,
  expected: {
    winner: end.winner,
    snapshot: snap,
  },
};

const outDir = path.join(ROOT, "tests", "fixtures");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `golden-greedy-seed${seed}.json`);
fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2), "utf8");
console.log(`Zapisano ${outPath} (${actions.length} akcji, zwycięzca ${end.winner})`);

import { describe, expect, it } from "vitest";
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  getValidActions,
} from "../src/rules.js";
import { randomInt } from "../src/rng.js";

function randomPlayToEnd(seed: number): "p0" | "p1" {
  let s = createInitialState(seed);
  let step = 0;
  const sim = seed ^ 0xdeadbeef;
  while (checkWinCondition(s).status === "ongoing" && step < 25_000) {
    const acts = getValidActions(s);
    const { value } = randomInt(sim, step, acts.length);
    s = applyAction(s, acts[value]!);
    step++;
  }
  const w = checkWinCondition(s);
  if (w.status !== "ended") throw new Error("no winner");
  return w.winner;
}

describe("balans — obaj gracze wygrywają przy różnych seedach", () => {
  it("w próbie 40 seedów każda strona wygrywa przynajmniej raz", () => {
    let p0 = 0;
    let p1 = 0;
    for (let i = 0; i < 40; i++) {
      const w = randomPlayToEnd(10_000 + i * 7919);
      if (w === "p0") p0++;
      else p1++;
    }
    expect(p0).toBeGreaterThan(0);
    expect(p1).toBeGreaterThan(0);
  });
});

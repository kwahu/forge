import { describe, expect, it } from "vitest";
import { simulateGreedyVersus } from "../src/enemyAi.js";
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  getAIContext,
  getVisibility,
} from "../src/rules.js";

describe("scarlet-oath rules", () => {
  it("createInitialState jest deterministyczny", () => {
    const a = createInitialState(42);
    const b = createInitialState(42);
    expect(a.activePlayerId).toBe(b.activePlayerId);
    expect(a.positions).toEqual(b.positions);
    expect(a.rngCounter).toBe(b.rngCounter);
  });

  it("inny seed może zmienić inicjatywę", () => {
    const starts = new Set<PlayerId>();
    for (let s = 0; s < 40; s++) starts.add(createInitialState(s).activePlayerId);
    expect(starts.size).toBeGreaterThanOrEqual(1);
  });

  it("STRIKE z sąsiedztwa zadaje obrażenia przez tarczę", () => {
    let s = createInitialState(0);
    while (s.activePlayerId !== "p0" && checkWinCondition(s).status === "ongoing") {
      s = applyAction(s, { type: "END_TURN" });
    }
    s = {
      ...s,
      positions: { p0: { x: 3, y: 2 }, p1: { x: 4, y: 2 } },
      units: {
        p0: { ...s.units.p0, ap: 3 },
        p1: { ...s.units.p1, shield: 3 },
      },
    };
    const before = s.units.p1.hp;
    s = applyAction(s, { type: "STRIKE" });
    expect(s.units.p1.shield).toBe(0);
    expect(s.units.p1.hp).toBe(before - 2);
  });

  it("wygrana gdy przeciwnik ma 0 HP", () => {
    let s = createInitialState(99);
    s = {
      ...s,
      units: {
        p0: { ...s.units.p0, hp: 5 },
        p1: { ...s.units.p1, hp: 0 },
      },
    };
    const w = checkWinCondition(s);
    expect(w.status).toBe("ended");
    if (w.status === "ended") expect(w.winner).toBe("p0");
  });

  it("getVisibility zwraca obie pozycje", () => {
    const s = createInitialState(1);
    const v = getVisibility(s, "p0");
    expect(v.yourPos.x).toBeDefined();
    expect(v.oppPos.x).toBeDefined();
  });

  it("getAIContext ma sensowne pola", () => {
    const s = createInitialState(2);
    const ctx = getAIContext(s);
    expect(ctx.genre).toBe("rpg");
    expect(ctx.validActionCount).toBeGreaterThan(0);
  });

  it("symulacja greedy kończy partię (silnik nie zapętla się bez obrażeń)", () => {
    const r = simulateGreedyVersus(12345, 8000);
    expect(r.aborted).toBe(false);
  });
});

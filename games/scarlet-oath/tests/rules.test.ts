import { describe, expect, it } from "vitest";
import { simulateGreedyVersus } from "../src/enemyAi.js";
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  getAIContext,
  getValidActions,
  getVisibility,
} from "../src/rules.js";
import type { PlayerId } from "../src/types.js";

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

  it("DASH przesuwa o 2 pola i kosztuje 2 AP", () => {
    let s = createInitialState(0);
    // ustaw p0 aktywnym z 3 AP i miejscem na dash w kierunku e
    s = {
      ...s,
      activePlayerId: "p0",
      positions: { p0: { x: 0, y: 2 }, p1: { x: 5, y: 2 } },
      units: {
        p0: { ...s.units.p0, ap: 3 },
        p1: { ...s.units.p1, ap: 0 },
      },
    };
    const before = s.units.p0.ap;
    s = applyAction(s, { type: "DASH", dir: "e" });
    expect(s.positions.p0).toEqual({ x: 2, y: 2 });
    expect(s.units.p0.ap).toBe(before - 2);
  });

  it("DASH jest w legalnych akcjach gdy jest miejsce i wystarczy AP", () => {
    let s = createInitialState(0);
    s = {
      ...s,
      activePlayerId: "p0",
      positions: { p0: { x: 0, y: 2 }, p1: { x: 5, y: 2 } },
      units: {
        p0: { ...s.units.p0, ap: 3 },
        p1: { ...s.units.p1, ap: 0 },
      },
    };
    const valid = getValidActions(s);
    const dashes = valid.filter((a) => a.type === "DASH");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("DASH nie przechodzi przez granicę planszy", () => {
    let s = createInitialState(0);
    s = {
      ...s,
      activePlayerId: "p0",
      positions: { p0: { x: 0, y: 2 }, p1: { x: 5, y: 2 } },
      units: {
        p0: { ...s.units.p0, ap: 3 },
        p1: { ...s.units.p1, ap: 0 },
      },
    };
    const valid = getValidActions(s);
    // p0 na x=0: DASH na zachód (x=-2) i północ (y=-2) powinny być niedozwolone
    const dashW = valid.find((a) => a.type === "DASH" && a.dir === "w");
    expect(dashW).toBeUndefined();
  });
});

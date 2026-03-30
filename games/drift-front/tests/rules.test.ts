import { describe, expect, it } from "vitest";
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  DEFAULT_BLOCKED,
  getAIContext,
  getValidActions,
  getVisibility,
} from "../src/rules.js";
import type { GameState } from "../src/types.js";

describe("drift-front rules", () => {
  it("createInitialState: 4 jednostki, pełne HP, na planszy 5×5", () => {
    const s = createInitialState(42);
    expect(s.boardWidth).toBe(5);
    expect(s.units).toHaveLength(4);
    expect(s.blocked).toEqual(DEFAULT_BLOCKED);
    expect(s.units.every((u) => u.hp === 5)).toBe(true);
    expect(checkWinCondition(s).status).toBe("ongoing");
  });

  it("nie można wejść na pole zablokowane", () => {
    const base = createInitialState(0);
    const s: GameState = {
      ...base,
      activePlayerId: "p0",
      blocked: [{ x: 1, y: 1 }],
      units: [
        { owner: "p0", slot: 0, x: 0, y: 1, hp: 5 },
        { owner: "p0", slot: 1, x: 0, y: 0, hp: 5 },
        { owner: "p1", slot: 0, x: 4, y: 4, hp: 5 },
        { owner: "p1", slot: 1, x: 3, y: 4, hp: 5 },
      ],
    };
    expect(getValidActions(s).some((a) => a.type === "MOVE" && a.dir === "E" && a.slot === 0)).toBe(false);
  });

  it("ten sam seed → ten sam pierwszy gracz i stan", () => {
    const a = createInitialState(7);
    const b = createInitialState(7);
    expect(a.activePlayerId).toBe(b.activePlayerId);
    expect(a.units).toEqual(b.units);
  });

  it("getValidActions zwraca ruchy i ataki gdy są legalne", () => {
    const s = createInitialState(0);
    const acts = getValidActions(s);
    expect(acts.length).toBeGreaterThan(0);
    expect(acts.some((a) => a.type === "MOVE")).toBe(true);
  });

  it("applyAction: ruch zmienia pozycję i zmienia aktywnego gracza", () => {
    let s = createInitialState(1);
    const pid = s.activePlayerId;
    const move = getValidActions(s).find((a) => a.type === "MOVE");
    expect(move).toBeDefined();
    const uBefore = s.units.find((x) => x.owner === pid && x.slot === move!.slot)!;
    const delta: Record<string, [number, number]> = {
      N: [0, -1],
      E: [1, 0],
      S: [0, 1],
      W: [-1, 0],
    };
    const [dx, dy] = delta[move!.dir]!;
    s = applyAction(s, move!);
    expect(s.activePlayerId).not.toBe(pid);
    const uAfter = s.units.find((x) => x.owner === pid && x.slot === move!.slot)!;
    expect(uAfter.x).toBe(uBefore.x + dx);
    expect(uAfter.y).toBe(uBefore.y + dy);
  });

  it("applyAction: nielegalna akcja nie zmienia stanu", () => {
    const base = createInitialState(0);
    const s0: GameState = {
      ...base,
      activePlayerId: "p0",
      rngCounter: base.rngCounter,
    };
    const bad = { type: "MOVE" as const, slot: 0 as const, dir: "W" as const };
    expect(getValidActions(s0).some((a) => a.type === "MOVE" && a.dir === "W" && a.slot === 0)).toBe(
      false,
    );
    const s1 = applyAction(s0, bad);
    expect(s1).toEqual(s0);
  });

  it("eliminacja wszystkich wrogów kończy grę zwycięstwem aktora", () => {
    let s: ReturnType<typeof createInitialState> = {
      ...createInitialState(99),
      units: [
        { owner: "p0", slot: 0, x: 2, y: 2, hp: 5 },
        { owner: "p0", slot: 1, x: 0, y: 0, hp: 0 },
        { owner: "p1", slot: 0, x: 2, y: 3, hp: 1 },
        { owner: "p1", slot: 1, x: 0, y: 4, hp: 0 },
      ],
      activePlayerId: "p0",
      halfTurnIndex: 0,
    };
    const atk = { type: "ATTACK" as const, slot: 0 as const, dir: "S" as const };
    const valid = getValidActions(s);
    expect(valid.some((a) => a.type === "ATTACK" && a.dir === "S" && a.slot === 0)).toBe(true);
    s = applyAction(s, atk);
    const w = checkWinCondition(s);
    expect(w.status).toBe("ended");
    if (w.status === "ended" && w.winner !== null) expect(w.winner).toBe("p0");
  });

  it("getVisibility / getAIContext — brak ukrytej planszy (pełna informacja)", () => {
    const s = createInitialState(3);
    const v0 = getVisibility(s, "p0");
    const v1 = getVisibility(s, "p1");
    expect(v0.units).toEqual(v1.units);
    const ctx = getAIContext(s, "p0");
    expect(ctx.validActionCount).toBe(getValidActions(s).length);
    expect(ctx.summary).toContain("Plansza");
  });
});

import { describe, expect, it } from "vitest";
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  getValidActions,
  getVisibility,
  pickSimpleBotAction,
} from "../src/rules.js";

describe("deepspire rules", () => {
  it("createInitialState jest deterministyczny", () => {
    const a = createInitialState(42);
    const b = createInitialState(42);
    expect(a.player).toEqual(b.player);
    expect(a.stairs).toEqual(b.stairs);
    expect(a.enemies).toEqual(b.enemies);
    expect(a.rngCounter).toBe(b.rngCounter);
  });

  it("inny seed = inna mapa (zwykle)", () => {
    const a = createInitialState(1);
    const b = createInitialState(999111);
    const same =
      a.stairs.x === b.stairs.x &&
      a.stairs.y === b.stairs.y &&
      a.enemies.length === b.enemies.length &&
      JSON.stringify(a.grid) === JSON.stringify(b.grid);
    expect(same).toBe(false);
  });

  it("WAIT zawsze legalne przy grze w toku", () => {
    const s = createInitialState(7);
    const acts = getValidActions(s);
    expect(acts.some((a) => a.type === "WAIT")).toBe(true);
  });

  it("getVisibility zwraca pełny widok bohatera", () => {
    const s = createInitialState(3);
    const v = getVisibility(s, "hero");
    expect(v.depth).toBe(1);
    expect(v.player.hp).toBeGreaterThan(0);
    expect(v.grid.length).toBe(s.height);
  });

  it("zwycięstwo: zejście ze schodów na docelowej głębokości", () => {
    let s = createInitialState(11);
    s = {
      ...s,
      depth: s.winDepth,
      player: { ...s.player, x: s.stairs.x, y: s.stairs.y },
    };
    s = applyAction(s, { type: "DESCEND" });
    expect(s.terminal?.outcome).toBe("victory");
    expect(checkWinCondition(s).status).toBe("ended");
  });

  it("śmierć: HP spada do 0 => koniec", () => {
    let s = createInitialState(100);
    const { x: px, y: py } = s.player;
    const ortho = [
      { x: px + 1, y: py },
      { x: px - 1, y: py },
      { x: px, y: py + 1 },
      { x: px, y: py - 1 },
    ].find(
      (p) =>
        p.x >= 0 &&
        p.y >= 0 &&
        p.x < s.width &&
        p.y < s.height &&
        (s.grid[p.y]![p.x] === "floor" || s.grid[p.y]![p.x] === "stairs"),
    );
    expect(ortho).toBeDefined();
    s = {
      ...s,
      player: { ...s.player, hp: 1 },
      enemies: [
        {
          id: "adj",
          x: ortho!.x,
          y: ortho!.y,
          hp: 1,
        },
      ],
    };
    s = applyAction(s, { type: "WAIT" });
    const w = checkWinCondition(s);
    expect(w.status).toBe("ended");
    if (w.status === "ended") expect(w.outcome).toBe("death");
  });

  it("symulacja: bot aż do końca lub limit", () => {
    let s = createInitialState(2026);
    let guard = 0;
    const maxSteps = 50_000;
    while (checkWinCondition(s).status === "ongoing" && guard < maxSteps) {
      const acts = getValidActions(s);
      expect(acts.length).toBeGreaterThan(0);
      s = applyAction(s, pickSimpleBotAction(s));
      guard++;
    }
    expect(checkWinCondition(s).status).toBe("ended");
  });
});

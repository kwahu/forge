import { describe, expect, it } from "vitest";
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  getValidActions,
  getVisibility,
} from "../src/rules.js";

describe("rift-duel rules", () => {
  it("createInitialState jest deterministyczny", () => {
    const a = createInitialState(42);
    const b = createInitialState(42);
    expect(a.players.p0.hand).toEqual(b.players.p0.hand);
    expect(a.players.p1.hand).toEqual(b.players.p1.hand);
    expect(a.rngCounter).toBe(b.rngCounter);
  });

  it("inny seed = inna talia", () => {
    const a = createInitialState(1);
    const b = createInitialState(2);
    expect(a.players.p0.deck.length).toBe(b.players.p0.deck.length);
    const same =
      a.players.p0.hand.join() === b.players.p0.hand.join() &&
      a.players.p1.hand.join() === b.players.p1.hand.join();
    expect(same).toBe(false);
  });

  it("gra kończy się po obniżeniu HP", () => {
    let s = createInitialState(99);
    s = {
      ...s,
      players: {
        p0: { ...s.players.p0, hp: 1 },
        p1: { ...s.players.p1, hp: 50 },
      },
    };
    const win = checkWinCondition(s);
    expect(win.status).toBe("ongoing");
    s = {
      ...s,
      players: {
        ...s.players,
        p0: { ...s.players.p0, hp: 0 },
      },
    };
    const end = checkWinCondition(s);
    expect(end.status).toBe("ended");
    if (end.status === "ended") expect(end.winner).toBe("p1");
  });

  it("getVisibility ukrywa rękę przeciwnika", () => {
    const s = createInitialState(7);
    const v = getVisibility(s, "p0");
    expect(v.you.hand.length).toBeGreaterThan(0);
    expect(v.opponent.handCount).toBeGreaterThan(0);
    expect((v.opponent as { hand?: unknown }).hand).toBeUndefined();
  });

  it("symulacja: losowe akcje do końca (bounded)", () => {
    let s = createInitialState(12345);
    let guard = 0;
    while (checkWinCondition(s).status === "ongoing" && guard < 5000) {
      const acts = getValidActions(s);
      expect(acts.length).toBeGreaterThan(0);
      const pick = acts[Math.floor(Math.abs(Math.sin(guard)) * acts.length) % acts.length];
      s = applyAction(s, pick);
      guard++;
    }
    expect(checkWinCondition(s).status).toBe("ended");
  });
});

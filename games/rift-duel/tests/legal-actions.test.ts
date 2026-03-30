import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/rules.js";
import { describeLegalActions } from "../server/legalActions.js";

describe("describeLegalActions", () => {
  it("zwraca koniec tury i zagrania z ręki", () => {
    const s = createInitialState(42);
    const d = describeLegalActions(s);
    expect(d.count).toBeGreaterThan(2);
    expect(d.options.some((o) => o.shortLabel === "Koniec tury")).toBe(true);
    const play = d.options.filter((o) => o.action.type === "PLAY_CARD");
    expect(play.length).toBe(s.players[s.activePlayerId].hand.length);
    const end = d.options.find((o) => o.action.type === "END_TURN");
    expect(end?.detail).toMatch(/Strażnik|Rozwarstwienie/);
  });
});

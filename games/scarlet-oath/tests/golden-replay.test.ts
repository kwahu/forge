import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createInitialState } from "../src/rules.js";
import { actionsEqual, combatSnapshot, replayActions } from "../src/replay.js";
import type { GameAction } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, "fixtures");

interface GoldenFixture {
  gameId: string;
  contentVersion: string;
  profile: string;
  seed: number;
  actions: GameAction[];
  expected: {
    winner: "p0" | "p1";
    snapshot: ReturnType<typeof combatSnapshot>;
  };
}

function loadGolden(name: string): GoldenFixture {
  const raw = readFileSync(path.join(FIXTURE_DIR, name), "utf8");
  return JSON.parse(raw) as GoldenFixture;
}

describe("golden replay (regresja)", () => {
  it("fixture greedy seed 42 — pełne odtworzenie", () => {
    const f = loadGolden("golden-greedy-seed42.json");
    expect(f.gameId).toBe("scarlet-oath");
    expect(f.contentVersion).toBe(createInitialState(0).contentVersion);

    const state = replayActions(f.seed, f.actions);
    const snap = combatSnapshot(state);
    expect(snap.outcome).toEqual({ status: "ended", winner: f.expected.winner });
    expect(snap).toEqual(f.expected.snapshot);
  });

  it("fixture greedy seed 4 — wygrana p1 (SO-003)", () => {
    const f = loadGolden("golden-greedy-seed4.json");
    expect(f.gameId).toBe("scarlet-oath");
    expect(f.contentVersion).toBe(createInitialState(0).contentVersion);
    expect(f.expected.winner).toBe("p1");

    const state = replayActions(f.seed, f.actions);
    const snap = combatSnapshot(state);
    expect(snap.outcome).toEqual({ status: "ended", winner: "p1" });
    expect(snap).toEqual(f.expected.snapshot);
  });

  it("replay odrzuca nielegalną akcję", () => {
    const f = loadGolden("golden-greedy-seed42.json");
    const bad = [...f.actions];
    bad[0] = { type: "STRIKE" };
    expect(() => replayActions(f.seed, bad)).toThrow(/nielegalna akcja/);
  });

  it("actionsEqual rozróżnia kierunki", () => {
    expect(actionsEqual({ type: "MOVE", dir: "n" }, { type: "MOVE", dir: "n" })).toBe(true);
    expect(actionsEqual({ type: "MOVE", dir: "n" }, { type: "MOVE", dir: "s" })).toBe(false);
    expect(actionsEqual({ type: "DASH", dir: "e" }, { type: "DASH", dir: "e" })).toBe(true);
    expect(actionsEqual({ type: "DASH", dir: "e" }, { type: "DASH", dir: "w" })).toBe(false);
    expect(actionsEqual({ type: "DASH", dir: "n" }, { type: "MOVE", dir: "n" })).toBe(false);
  });
});

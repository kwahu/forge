/**
 * Heurystyki AI — wspólne dla serwera, symulacji i macierzy matchupów (FORGE §6.4).
 */
import { getValidActions } from "./rules.js";
import { randomInt } from "./rng.js";
import type { Dir, GameAction, GameState, PlayerId, UnitState } from "./types.js";

const DIR_DELTA: Record<Dir, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
};

const ATTACK_DAMAGE = 2;

function living(units: UnitState[]): UnitState[] {
  return units.filter((u) => u.hp > 0);
}

function occupantAt(units: UnitState[], x: number, y: number): UnitState | undefined {
  return living(units).find((u) => u.x === x && u.y === y);
}

function getUnit(state: GameState, owner: PlayerId, slot: 0 | 1): UnitState | undefined {
  return state.units.find((u) => u.owner === owner && u.slot === slot);
}

function minManhattanToEnemies(state: GameState, me: PlayerId, x: number, y: number): number {
  const enemies = living(state.units).filter((u) => u.owner !== me);
  if (enemies.length === 0) return 0;
  return Math.min(...enemies.map((e) => Math.abs(e.x - x) + Math.abs(e.y - y)));
}

function minHpMySide(state: GameState, me: PlayerId): number {
  const mine = living(state.units).filter((u) => u.owner === me);
  if (mine.length === 0) return 0;
  return Math.min(...mine.map((u) => u.hp));
}

/** Minimalna odległość Manhattan między dowolną parą żywych jednostek (ja vs wróg). */
function minBattleDist(state: GameState, me: PlayerId): number {
  const mine = living(state.units).filter((u) => u.owner === me);
  const theirs = living(state.units).filter((u) => u.owner !== me);
  if (mine.length === 0 || theirs.length === 0) return 99;
  let m = 99;
  for (const u of mine) {
    for (const t of theirs) {
      const d = Math.abs(u.x - t.x) + Math.abs(u.y - t.y);
      if (d < m) m = d;
    }
  }
  return m;
}

function scoreAction(state: GameState, me: PlayerId, action: GameAction): number {
  const u = getUnit(state, me, action.slot);
  if (!u || u.hp <= 0) return -1e9;
  const { dx, dy } = DIR_DELTA[action.dir];
  const tx = u.x + dx;
  const ty = u.y + dy;

  if (action.type === "ATTACK") {
    const t = occupantAt(state.units, tx, ty);
    if (!t || t.owner === me) return -1e9;
    const nh = t.hp - ATTACK_DAMAGE;
    if (nh <= 0) return 1_000_000;
    return 10_000 + (ATTACK_DAMAGE * 1000) / Math.max(1, t.hp);
  }

  const dist = minManhattanToEnemies(state, me, tx, ty);
  return 5000 - dist * 100;
}

export type BotStrategyId = "spike" | "aggro" | "turtle" | "random";

export const DEFAULT_BOT_STRATEGY_P0: BotStrategyId = "spike";
export const DEFAULT_BOT_STRATEGY_P1: BotStrategyId = "aggro";

export const BOT_STRATEGIES_FOR_API: {
  id: BotStrategyId;
  labelPl: string;
  hintPl: string;
}[] = [
  { id: "spike", labelPl: "Spike", hintPl: "Zabójstwo > obrażenia > zbliżenie" },
  { id: "aggro", labelPl: "Agresor", hintPl: "Atak jeśli możliwy, inaczej zbliżenie" },
  {
    id: "turtle",
    labelPl: "Obrońca",
    hintPl: "Z daleka zbliża się (jak Agresor); w kontakcie walczy; przy niskim HP ucieka / dobija",
  },
  { id: "random", labelPl: "Losowy", hintPl: "Chaos — tylko widowisko / test symetrii" },
];

export function parseBotStrategyId(raw: unknown, fallback: BotStrategyId): BotStrategyId {
  if (raw === "spike" || raw === "aggro" || raw === "turtle" || raw === "random") return raw;
  return fallback;
}

function pickRandom(
  acts: GameAction[],
  seed: number,
  step: number,
  me: PlayerId,
): GameAction {
  const c = step * 31 + (me === "p1" ? 17 : 0);
  const pick = randomInt(seed, c, acts.length);
  return acts[pick.value]!;
}

function pickAggro(state: GameState, me: PlayerId, acts: GameAction[]): GameAction {
  const attacks = acts.filter((a) => a.type === "ATTACK");
  if (attacks.length > 0) {
    return attacks.reduce((best, a) => (scoreAction(state, me, a) > scoreAction(state, me, best) ? a : best));
  }
  return acts.reduce((best, a) => (scoreAction(state, me, a) > scoreAction(state, me, best) ? a : best));
}

function pickTurtle(state: GameState, me: PlayerId, acts: GameAction[]): GameAction {
  const dist = minBattleDist(state, me);
  // Symetryczne partie "turtle vs turtle" potrafią zapętlić się na limicie półtur.
  // Dodajemy deterministyczny bias w trybie z dalekiego dystansu, żeby wymusić
  // asymetrię decyzji (bez losowości).
  if (dist >= 3) {
    // Dla mirror matchupów nie wystarcza bias "po me" — w praktyce to zostaje symetryczne.
    // Bias opieramy o globalną półturę: przy parzystym półkroku preferuj E, przy nieparzystym W.
    const preferredDir: Dir = state.halfTurnIndex % 2 === 0 ? "E" : "W";
    const otherDir: Dir = preferredDir === "E" ? "W" : "E";
    const DIR_RANK_GLOBAL: Record<Dir, number> = {
      [preferredDir]: 0,
      N: 1,
      S: 2,
      [otherDir]: 3,
    } as Record<Dir, number>;

    const dirBias = (dir: Dir): number => {
      if (dir === preferredDir) return 7;
      if (dir === "N" || dir === "S") return 4;
      return 0;
    };
    const preferredSlot: 0 | 1 = state.halfTurnIndex % 2 === 0 ? 0 : 1;
    const slotBias = (slot: 0 | 1): number => (slot === preferredSlot ? 1 : 0);

    let best = acts[0]!;
    let bestScore = -1e18;

    for (const a of acts) {
      let s = scoreAction(state, me, a);
      if (a.type === "MOVE") {
        s += dirBias(a.dir) + slotBias(a.slot);
      }

      if (s > bestScore) {
        bestScore = s;
        best = a;
        continue;
      }
      if (s === bestScore) {
        // Tie-break bez zależności od heurystyki: preferencje wynikają z parzystości półkroku.
        const da = a.type === "MOVE" ? DIR_RANK_GLOBAL[a.dir] : 999;
        const db = best.type === "MOVE" ? DIR_RANK_GLOBAL[best.dir] : 999;
        if (da < db) best = a;
        else if (da === db && a.type === "MOVE" && best.type === "MOVE" && a.slot < best.slot)
          best = a;
      }
    }

    return best;
  }

  if (minHpMySide(state, me) <= 2) {
    const kills = acts.filter((a) => {
      if (a.type !== "ATTACK") return false;
      const u = getUnit(state, me, a.slot);
      if (!u) return false;
      const { dx, dy } = DIR_DELTA[a.dir];
      const t = occupantAt(state.units, u.x + dx, u.y + dy);
      return t && t.owner !== me && t.hp <= ATTACK_DAMAGE;
    });
    if (kills.length > 0) {
      return kills.reduce((best, a) =>
        scoreAction(state, me, a) > scoreAction(state, me, best) ? a : best,
      );
    }
    // Zamiast zawsze uciekać: jeśli atak jest legalny, weź najlepszy `ATTACK`,
    // żeby w mirrorach nie kończyć na limicie półtur bez eliminacji.
    const attacks = acts.filter((a) => a.type === "ATTACK");
    if (attacks.length > 0) {
      return attacks.reduce((best, a) =>
        scoreAction(state, me, a) > scoreAction(state, me, best) ? a : best,
      );
    }
    let best = acts[0]!;
    let bestScore = -1e9;
    for (const a of acts) {
      if (a.type !== "MOVE") continue;
      const u = getUnit(state, me, a.slot);
      if (!u) continue;
      const { dx, dy } = DIR_DELTA[a.dir];
      const tx = u.x + dx;
      const ty = u.y + dy;
      const d = minManhattanToEnemies(state, me, tx, ty);
      if (d > bestScore) {
        bestScore = d;
        best = a;
      }
    }
    if (bestScore > -1e8) return best;
    return pickSpike(state, me, acts);
  }

  return pickSpike(state, me, acts);
}

function pickSpike(state: GameState, me: PlayerId, acts: GameAction[]): GameAction {
  return acts.reduce((best, a) => (scoreAction(state, me, a) > scoreAction(state, me, best) ? a : best));
}

/**
 * Wybór akcji dla bota. `sim` — stała sesji (np. matchSeed) dla rozdzielenia PRNG między partie.
 */
export function pickBotAction(
  state: GameState,
  step: number,
  me: PlayerId,
  sim: number,
  strategy: BotStrategyId,
): GameAction {
  const acts = getValidActions(state);
  if (acts.length === 0) throw new Error("pickBotAction: brak legalnych akcji");
  if (strategy === "random") return pickRandom(acts, sim, step, me);
  if (strategy === "aggro") return pickAggro(state, me, acts);
  if (strategy === "turtle") return pickTurtle(state, me, acts);
  return pickSpike(state, me, acts);
}

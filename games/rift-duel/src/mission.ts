import type { PlayerId } from "./types.js";

/** Modyfikatory startu pojedynku (kampania / misje). */
export interface MissionStartOptions {
  id: string;
  extraOpeningDraws?: Partial<Record<PlayerId, number>>;
}

const PLAYERS: PlayerId[] = ["p0", "p1"];

function clampNonNegInt(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 20) return null;
  return n;
}

/** Waliduje i normalizuje `extraOpeningDraws` z JSON. */
export function parseExtraOpeningDraws(raw: unknown): Partial<Record<PlayerId, number>> | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<PlayerId, number>> = {};
  for (const pid of PLAYERS) {
    const v = clampNonNegInt(o[pid]);
    if (v != null && v > 0) out[pid] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseMissionStartOptions(raw: unknown): MissionStartOptions | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  const extra = parseExtraOpeningDraws(o.extraOpeningDraws);
  return extra ? { id: o.id.trim(), extraOpeningDraws: extra } : { id: o.id.trim() };
}

import { parseExtraOpeningDraws, type MissionStartOptions } from "./mission.js";

export interface CampaignStepPublic {
  id: string;
  titlePl: string;
  introPl: string;
  /** Krótki opis modyfikatorów dla gracza. */
  modifiersHintPl: string;
}

export interface CampaignStep extends CampaignStepPublic {
  mission: MissionStartOptions;
}

export interface CampaignFileParsed {
  version: number;
  campaignId: string;
  steps: CampaignStep[];
}

function modifiersHintPl(extra?: Partial<Record<"p0" | "p1", number>>): string {
  if (!extra || Object.keys(extra).length === 0) return "Start symetryczny — po 5 kart w ręku.";
  const p0 = extra.p0 ?? 0;
  const p1 = extra.p1 ?? 0;
  const parts: string[] = [];
  if (p0) parts.push(`Strażnik (p0): +${p0} ${p0 === 1 ? "karta" : "karty"} na początku.`);
  if (p1) parts.push(`Rozwarstwienie (p1): +${p1} ${p1 === 1 ? "karta" : "karty"} na początku.`);
  return parts.join(" ");
}

export function parseCampaignFile(raw: unknown): CampaignFileParsed | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  if (typeof root.version !== "number" || typeof root.campaignId !== "string") return null;
  const arr = root.steps;
  if (!Array.isArray(arr)) return null;
  const steps: CampaignStep[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id.trim()) return null;
    if (typeof o.titlePl !== "string" || typeof o.introPl !== "string") return null;
    const extra = parseExtraOpeningDraws(o.extraOpeningDraws);
    const id = o.id.trim();
    const mission: MissionStartOptions = extra ? { id, extraOpeningDraws: extra } : { id };
    const hint = modifiersHintPl(extra);
    steps.push({
      id,
      titlePl: o.titlePl,
      introPl: o.introPl,
      modifiersHintPl: hint,
      mission,
    });
  }
  return { version: root.version, campaignId: root.campaignId, steps };
}

export function campaignStepsForMeta(steps: CampaignStep[]): CampaignStepPublic[] {
  return steps.map(({ id, titlePl, introPl, modifiersHintPl }) => ({
    id,
    titlePl,
    introPl,
    modifiersHintPl,
  }));
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCampaignFile } from "../src/campaign.js";
import { createInitialState } from "../src/rules.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const campaignPath = path.join(__dirname, "../content/campaign.json");

describe("MissionConfig / kampania", () => {
  it("campaign.json parsuje się i ma 5 kroków", () => {
    const raw = JSON.parse(fs.readFileSync(campaignPath, "utf8")) as unknown;
    const c = parseCampaignFile(raw);
    expect(c).not.toBeNull();
    expect(c!.steps.length).toBe(5);
    expect(c!.steps[0]!.mission.id).toBe("S01_first_breach");
    expect(c!.steps[0]!.mission.extraOpeningDraws?.p1).toBe(1);
  });

  it("createInitialState bez misji — missionId null, symetryczne ręce", () => {
    const s = createInitialState(42, null);
    expect(s.missionId).toBeNull();
    expect(s.players.p0.hand.length).toBe(5);
    expect(s.players.p1.hand.length).toBe(5);
  });

  it("createInitialState z +1 doborem dla p1 — szósta karta u p1", () => {
    const s = createInitialState(42, { id: "test", extraOpeningDraws: { p1: 1 } });
    expect(s.missionId).toBe("test");
    expect(s.players.p0.hand.length).toBe(5);
    expect(s.players.p1.hand.length).toBe(6);
  });

  it("determinizm: ten sam seed i misja = identyczne ręce", () => {
    const m = { id: "x", extraOpeningDraws: { p0: 1 } as const };
    const a = createInitialState(999, m);
    const b = createInitialState(999, m);
    expect(a.players.p0.hand).toEqual(b.players.p0.hand);
    expect(a.players.p1.hand).toEqual(b.players.p1.hand);
  });
});

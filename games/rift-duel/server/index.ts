/**
 * FORGE-style game service: REST + WebSocket, bot + opcjonalny gracz ludzki (p0 | p1).
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { WebSocketServer, type WebSocket } from "ws";

import { campaignStepsForMeta, parseCampaignFile } from "../src/campaign.js";
import type { MissionStartOptions } from "../src/mission.js";
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  getValidActions,
} from "../src/rules.js";
import {
  BOT_STRATEGIES_FOR_API,
  DEFAULT_BOT_STRATEGY,
  type BotStrategyId,
  parseBotStrategyId,
  pickBotAction,
} from "../src/botStrategies.js";
import { CARD_META, getDeckCatalogForApi } from "../src/cards.js";
import type { GameAction, GameState, PlayerId } from "../src/types.js";
import {
  explainBotStep,
  narrativeResult,
  narrativeSnapshot,
  playerLabelPl,
} from "./botExplain.js";
import { describeLegalActions } from "./legalActions.js";
import { dailyChallengeForDay, isoDateUtc } from "./dailyChallenge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, "../client");
const CAMPAIGN_PATH = path.join(__dirname, "../content/campaign.json");

const CAMPAIGN_PARSED = (() => {
  try {
    const raw = JSON.parse(fs.readFileSync(CAMPAIGN_PATH, "utf8")) as unknown;
    const p = parseCampaignFile(raw);
    if (!p) console.warn("[rift-duel] campaign.json: parse failed");
    return p;
  } catch (e) {
    console.warn("[rift-duel] campaign.json load failed", e);
    return null;
  }
})();

const MISSION_BY_ID = new Map<string, MissionStartOptions>(
  CAMPAIGN_PARSED?.steps.map((s) => [s.id, s.mission]) ?? [],
);
const PORT = Number(process.env.RIFT_DUEL_PORT || 8787);
const DEFAULT_BOT_MS = Number(process.env.RIFT_DUEL_BOT_MS || 700);

interface Session {
  id: string;
  matchSeed: number;
  botStep: number;
  seq: number;
  state: GameState;
  botTimer: ReturnType<typeof setInterval> | null;
  clients: Set<WebSocket>;
  botDelayMs: number;
  botPaused: boolean;
  matchNumber: number;
  /** null = oba gracze to bot; p0/p1 = człowiek gra tą stroną, bot drugą */
  humanAs: PlayerId | null;
  /** Heurystyka decyzji bota (oba miejsca używają tego samego „silnika”). */
  botStrategy: BotStrategyId;
  /** Po rematchu ten sam seed (wyzwanie dnia). */
  challengeLockSeed: boolean;
  /** Data wyzwania (UTC), jeśli sesja z POST dailyChallenge. */
  dailyChallengeDate: string | null;
  missionStart: MissionStartOptions | null;
}

const sessions = new Map<string, Session>();
let idCounter = 1;

function makeId(): string {
  return `s${Date.now()}-${idCounter++}`;
}

function clampDelay(ms: number): number {
  return Math.max(150, Math.min(12000, Math.round(ms)));
}

function broadcast(sess: Session, payload: object) {
  const raw = JSON.stringify(payload);
  for (const ws of sess.clients) {
    if (ws.readyState === 1) ws.send(raw);
  }
}

function stopBot(sess: Session) {
  if (sess.botTimer) {
    clearInterval(sess.botTimer);
    sess.botTimer = null;
  }
}

function startBot(sess: Session) {
  stopBot(sess);
  if (sess.botPaused) return;
  const ms = clampDelay(sess.botDelayMs);
  sess.botTimer = setInterval(() => botTick(sess), ms);
}

function legalPayload(state: GameState) {
  const d = describeLegalActions(state);
  return {
    activePlayerId: d.activePlayerId,
    count: d.count,
    options: d.options.map((o) => ({
      n: o.n,
      shortLabel: o.shortLabel,
      detail: o.detail,
      action: o.action,
    })),
  };
}

function actionsEqual(a: GameAction, b: GameAction): boolean {
  if (a.type === "END_TURN" && b.type === "END_TURN") return true;
  if (a.type === "PLAY_CARD" && b.type === "PLAY_CARD") return a.handIndex === b.handIndex;
  return false;
}

function summarizeAction(before: GameState, action: GameAction): string {
  const pid = before.activePlayerId;
  const who = playerLabelPl(pid);
  if (action.type === "END_TURN") return `${who} → koniec tury`;
  const card = before.players[pid].hand[action.handIndex];
  if (!card) return `${who} · ?`;
  const m = CARD_META[card];
  return `${who} · ${m.name} (${card})`;
}

function broadcastEnded(sess: Session) {
  const end = checkWinCondition(sess.state);
  if (end.status !== "ended") return;
  stopBot(sess);
  broadcast(sess, {
    type: "ended",
    winner: end.winner,
    state: sess.state,
    matchNumber: sess.matchNumber,
    resultLine: narrativeResult(sess.state, end.winner),
    legalNow: { activePlayerId: "", count: 0, options: [] },
    humanAs: sess.humanAs,
    botStrategy: sess.botStrategy,
  });
  setTimeout(() => resetSessionForNextMatch(sess), 3200);
}

function botTick(sess: Session) {
  if (checkWinCondition(sess.state).status === "ended") {
    broadcastEnded(sess);
    return;
  }

  if (sess.humanAs && sess.state.activePlayerId === sess.humanAs) {
    return;
  }

  const acts = getValidActions(sess.state);
  if (acts.length === 0) return;

  const sim = sess.matchSeed * 0x1a2b3c4d;
  const me = sess.state.activePlayerId;
  const action = pickBotAction(sess.state, sess.botStep, me, sim, sess.botStrategy);
  let value = acts.findIndex((v) => actionsEqual(v, action));
  if (value < 0) value = 0;
  const before = sess.state;
  const summary = summarizeAction(before, action);
  const { reasoning, effectLine, playedCardId } = explainBotStep(before, action, value, acts.length);
  sess.state = applyAction(before, action);
  sess.botStep += 1;
  sess.seq += 1;

  broadcast(sess, {
    type: "step",
    actor: "bot",
    action,
    summary,
    state: sess.state,
    stepIndex: sess.seq,
    matchNumber: sess.matchNumber,
    reasoning,
    effectLine,
    playedCardId,
    playedHandIndex: action.type === "PLAY_CARD" ? action.handIndex : null,
    legalActionsCount: acts.length,
    chosenLegalIndex: value,
    chosenLegalN: value + 1,
    legalBeforeStep: legalPayload(before),
    legalNow: legalPayload(sess.state),
    narrative: narrativeSnapshot(sess.state),
    humanAs: sess.humanAs,
    botStrategy: sess.botStrategy,
    dailyChallengeDate: sess.dailyChallengeDate,
  });

  if (checkWinCondition(sess.state).status === "ended") {
    broadcastEnded(sess);
  }
}

function resetSessionForNextMatch(sess: Session) {
  sess.matchNumber += 1;
  if (!sess.challengeLockSeed) {
    sess.matchSeed = (sess.matchSeed + 7919 + Math.floor(Math.random() * 997)) >>> 0;
  }
  sess.botStep = 0;
  sess.seq = 0;
  sess.state = createInitialState(sess.matchSeed, sess.missionStart);
  broadcast(sess, {
    type: "snapshot",
    state: sess.state,
    matchSeed: sess.matchSeed,
    matchNumber: sess.matchNumber,
    message: `Nowa partia (#${sess.matchNumber}).`,
    narrative: narrativeSnapshot(sess.state),
    botDelayMs: sess.botDelayMs,
    botPaused: sess.botPaused,
    legalNow: legalPayload(sess.state),
    humanAs: sess.humanAs,
    botStrategy: sess.botStrategy,
    dailyChallengeDate: sess.dailyChallengeDate,
  });
  startBot(sess);
}

function sessionPayload(sess: Session) {
  return {
    id: sess.id,
    matchSeed: sess.matchSeed,
    matchNumber: sess.matchNumber,
    turnIndex: sess.state.turnIndex,
    activePlayerId: sess.state.activePlayerId,
    ended: checkWinCondition(sess.state).status === "ended",
    p0Hp: sess.state.players.p0.hp,
    p1Hp: sess.state.players.p1.hp,
    spectators: sess.clients.size,
    botRunning: sess.botTimer != null,
    botPaused: sess.botPaused,
    botDelayMs: sess.botDelayMs,
    humanAs: sess.humanAs,
    botStrategy: sess.botStrategy,
    challengeLockSeed: sess.challengeLockSeed,
    dailyChallengeDate: sess.dailyChallengeDate,
    missionId: sess.state.missionId,
  };
}

function createSession(
  seed: number | undefined,
  autoPlay: boolean,
  humanAs: PlayerId | null | undefined,
  botStrategy?: BotStrategyId,
  challengeLockSeed = false,
  dailyChallengeDate: string | null = null,
  missionStart: MissionStartOptions | null = null,
): Session {
  const matchSeed = seed ?? ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  const id = makeId();
  const sess: Session = {
    id,
    matchSeed,
    botStep: 0,
    seq: 0,
    state: createInitialState(matchSeed, missionStart),
    botTimer: null,
    clients: new Set(),
    botDelayMs: clampDelay(DEFAULT_BOT_MS),
    botPaused: false,
    matchNumber: 1,
    humanAs: humanAs === "p0" || humanAs === "p1" ? humanAs : null,
    botStrategy: botStrategy ?? DEFAULT_BOT_STRATEGY,
    challengeLockSeed,
    dailyChallengeDate,
    missionStart,
  };
  sessions.set(id, sess);
  if (autoPlay) startBot(sess);
  return sess;
}

function snapshotFields(sess: Session) {
  return {
    state: sess.state,
    matchSeed: sess.matchSeed,
    sessionId: sess.id,
    botRunning: sess.botTimer != null,
    matchNumber: sess.matchNumber,
    narrative: narrativeSnapshot(sess.state),
    botDelayMs: sess.botDelayMs,
    botPaused: sess.botPaused,
    legalNow: legalPayload(sess.state),
    humanAs: sess.humanAs,
    botStrategy: sess.botStrategy,
    dailyChallengeDate: sess.dailyChallengeDate,
  };
}

function attachClient(sess: Session, ws: WebSocket) {
  sess.clients.add(ws);
  ws.send(JSON.stringify({ type: "snapshot", ...snapshotFields(sess) }));
  ws.on("close", () => {
    sess.clients.delete(ws);
  });
}

const app = express();
app.use(express.json());

app.get("/api/meta", (_req, res) => {
  const today = isoDateUtc(new Date());
  const daily = dailyChallengeForDay(today);
  res.json({
    cardMeta: CARD_META,
    deckCatalog: getDeckCatalogForApi(),
    contentVersion: "0.7.3",
    botStrategies: BOT_STRATEGIES_FOR_API,
    service: "rift-duel-ws",
    dailyChallenge: {
      date: daily.date,
      seed: daily.seed,
      botStrategy: daily.botStrategy,
      rulesPl:
        "Jedna ułożenie talii na dzień (UTC). Bot gra wskazaną strategią; kolejne partie w tej samej sesji = ten sam seed. Porównuj wyniki po stronie (Strażnik / Rozwarstwienie).",
    },
    campaign: CAMPAIGN_PARSED
      ? {
          campaignId: CAMPAIGN_PARSED.campaignId,
          version: CAMPAIGN_PARSED.version,
          steps: campaignStepsForMeta(CAMPAIGN_PARSED.steps),
        }
      : null,
  });
});

app.get("/api/daily-challenge/:date", (req, res) => {
  const d = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    res.status(400).json({ error: "invalid_date" });
    return;
  }
  try {
    res.json(dailyChallengeForDay(d));
  } catch {
    res.status(400).json({ error: "invalid_date" });
  }
});

app.get("/api/sessions", (_req, res) => {
  res.json({ sessions: [...sessions.values()].map(sessionPayload) });
});

app.post("/api/sessions", (req, res) => {
  const autoPlay = req.body?.autoPlay !== false;
  const delayMs = typeof req.body?.botDelayMs === "number" ? req.body.botDelayMs : undefined;
  const humanRaw = req.body?.humanAs;
  const humanAs = humanRaw === "p0" || humanRaw === "p1" ? humanRaw : null;

  const dailyRaw = req.body?.dailyChallenge;
  let seed: number | undefined = typeof req.body?.seed === "number" ? req.body.seed : undefined;
  let botStrategy = parseBotStrategyId(req.body?.botStrategy, "spike");
  let challengeLockSeed = false;
  let dailyChallengeDate: string | null = null;

  if (dailyRaw === true || typeof dailyRaw === "string") {
    const iso =
      typeof dailyRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dailyRaw) ? dailyRaw : isoDateUtc(new Date());
    try {
      const ch = dailyChallengeForDay(iso);
      seed = ch.seed;
      botStrategy = ch.botStrategy;
      challengeLockSeed = true;
      dailyChallengeDate = ch.date;
    } catch {
      res.status(400).json({ error: "invalid_daily_challenge" });
      return;
    }
  }

  let missionStart: MissionStartOptions | null = null;
  const mid = req.body?.missionId;
  if (typeof mid === "string" && mid.trim()) {
    const m = MISSION_BY_ID.get(mid.trim());
    if (!m) {
      res.status(400).json({ error: "unknown_mission", missionId: mid.trim() });
      return;
    }
    missionStart = m;
  }

  const sess = createSession(seed, false, humanAs, botStrategy, challengeLockSeed, dailyChallengeDate, missionStart);
  if (delayMs !== undefined) sess.botDelayMs = clampDelay(delayMs);
  if (autoPlay) startBot(sess);
  res.status(201).json(sessionPayload(sess));
});

app.get("/api/sessions/:id", (req, res) => {
  const sess = sessions.get(req.params.id);
  if (!sess) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({
    ...snapshotFields(sess),
    seq: sess.seq,
  });
});

/** Ruch gracza ludzkiego (gdy humanAs ustawione i jego tura). */
app.post("/api/sessions/:id/action", (req, res) => {
  const sess = sessions.get(req.params.id);
  if (!sess) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const action = req.body?.action as GameAction | undefined;
  if (!action || (action.type !== "PLAY_CARD" && action.type !== "END_TURN")) {
    res.status(400).json({ error: "invalid_body", hint: "{ action: { type, handIndex? } }" });
    return;
  }
  if (action.type === "PLAY_CARD" && typeof action.handIndex !== "number") {
    res.status(400).json({ error: "invalid_action" });
    return;
  }

  if (checkWinCondition(sess.state).status === "ended") {
    res.status(400).json({ error: "game_ended" });
    return;
  }
  if (!sess.humanAs) {
    res.status(403).json({
      error: "human_control_disabled",
      hint: "PATCH /api/sessions/:id/control { humanAs: 'p0' | 'p1' }",
    });
    return;
  }
  if (sess.state.activePlayerId !== sess.humanAs) {
    res.status(403).json({ error: "not_your_turn", active: sess.state.activePlayerId });
    return;
  }

  const before = sess.state;
  const valid = getValidActions(before);
  const idx = valid.findIndex((v) => actionsEqual(v, action));
  if (idx < 0) {
    res.status(400).json({ error: "illegal_action" });
    return;
  }

  sess.state = applyAction(before, action);
  sess.seq += 1;

  let effectLine: string | null = null;
  let playedCardId: string | null = null;
  if (action.type === "PLAY_CARD") {
    const c = before.players[before.activePlayerId].hand[action.handIndex];
    if (c) {
      playedCardId = c;
      effectLine = CARD_META[c].description;
    }
  }

  broadcast(sess, {
    type: "step",
    actor: "human",
    action,
    summary: summarizeAction(before, action),
    state: sess.state,
    stepIndex: sess.seq,
    matchNumber: sess.matchNumber,
    reasoning: "Twój ruch (gracz ludzki).",
    effectLine,
    playedCardId,
    playedHandIndex: action.type === "PLAY_CARD" ? action.handIndex : null,
    legalActionsCount: valid.length,
    chosenLegalIndex: idx,
    chosenLegalN: idx + 1,
    legalBeforeStep: legalPayload(before),
    legalNow: legalPayload(sess.state),
    narrative: narrativeSnapshot(sess.state),
    humanAs: sess.humanAs,
    botStrategy: sess.botStrategy,
    dailyChallengeDate: sess.dailyChallengeDate,
  });

  if (checkWinCondition(sess.state).status === "ended") {
    broadcastEnded(sess);
  }

  res.json({ ok: true, seq: sess.seq });
});

/** Ustawienie, którą stronę gra człowiek (null = tylko boty). */
app.patch("/api/sessions/:id/control", (req, res) => {
  const sess = sessions.get(req.params.id);
  if (!sess) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const h = req.body?.humanAs;
  sess.humanAs = h === "p0" || h === "p1" ? h : null;
  stopBot(sess);
  startBot(sess);
  broadcast(sess, {
    type: "snapshot",
    ...snapshotFields(sess),
    message: sess.humanAs
      ? `Sterowanie: gracz ludzki jako ${sess.humanAs}.`
      : "Sterowanie: obaj gracze — bot.",
  });
  res.json(sessionPayload(sess));
});

app.patch("/api/sessions/:id/bot", (req, res) => {
  const sess = sessions.get(req.params.id);
  if (!sess) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (typeof req.body?.delayMs === "number") {
    sess.botDelayMs = clampDelay(req.body.delayMs);
  }
  if (typeof req.body?.paused === "boolean") {
    sess.botPaused = req.body.paused;
  }
  if (req.body?.botStrategy !== undefined && !sess.dailyChallengeDate) {
    sess.botStrategy = parseBotStrategyId(req.body.botStrategy, sess.botStrategy);
  }
  stopBot(sess);
  startBot(sess);
  broadcast(sess, {
    type: "snapshot",
    ...snapshotFields(sess),
    message: `Strategia bota: ${sess.botStrategy}.`,
  });
  res.json(sessionPayload(sess));
});

app.use(express.static(CLIENT_DIR));

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    ws.close(4000, "sessionId required");
    return;
  }
  const sess = sessions.get(sessionId);
  if (!sess) {
    ws.close(4004, "session not found");
    return;
  }
  attachClient(sess, ws);
});

server.listen(PORT, () => {
  console.log(`[rift-duel] http://127.0.0.1:${PORT}`);
  const demo = createSession(undefined, true, null, "spike", false, null, null);
  console.log(`[rift-duel] demo session ${demo.id}`);
});

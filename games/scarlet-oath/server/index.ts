/**
 * FORGE-style usługa: REST + WebSocket, bot (greedy) + opcjonalny gracz ludzki (p0 | p1).
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { WebSocketServer, type WebSocket } from "ws";

import { pickGreedyAction } from "../src/enemyAi.js";
import {
  AP_PER_TURN,
  STRIKE_DAMAGE,
  applyAction,
  checkWinCondition,
  createInitialState,
  getValidActions,
} from "../src/rules.js";
import type { GameAction, GameState, PlayerId } from "../src/types.js";
import { describeLegalActions, playerLabelPl } from "./legalActions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, "../client");
const CHANGELOG_PATH = path.join(__dirname, "../docs/CHANGELOG.yaml");
const PORT = Number(process.env.SCARLET_OATH_PORT || 8788);
const DEFAULT_BOT_MS = Number(process.env.SCARLET_OATH_BOT_MS || 650);

interface Session {
  id: string;
  matchSeed: number;
  seq: number;
  state: GameState;
  botTimer: ReturnType<typeof setInterval> | null;
  clients: Set<WebSocket>;
  botDelayMs: number;
  botPaused: boolean;
  matchNumber: number;
  humanAs: PlayerId | null;
}

const sessions = new Map<string, Session>();
let idCounter = 1;

function makeId(): string {
  return `so-${Date.now()}-${idCounter++}`;
}

function clampDelay(ms: number): number {
  return Math.max(120, Math.min(10000, Math.round(ms)));
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
  if (a.type !== b.type) return false;
  if (a.type === "MOVE" && b.type === "MOVE") return a.dir === b.dir;
  return true;
}

function summarizeAction(before: GameState, action: GameAction): string {
  const pid = before.activePlayerId;
  const who = playerLabelPl(pid);
  if (action.type === "END_TURN") return `${who} → koniec tury`;
  if (action.type === "WARD") return `${who} · tarcza`;
  if (action.type === "STRIKE") return `${who} · cios (${STRIKE_DAMAGE})`;
  if (action.type === "MOVE") return `${who} · ruch ${action.dir}`;
  return `${who} · ?`;
}

function narrativeSnapshot(state: GameState): string {
  const { p0, p1 } = state.units;
  return [
    `Tura ${state.turnIndex} · aktywny ${playerLabelPl(state.activePlayerId)} · AP ${state.units[state.activePlayerId].ap}/${AP_PER_TURN}.`,
    `Seeker HP ${p0.hp}/${p0.maxHp} · tarcza ${p0.shield} | Echo HP ${p1.hp}/${p1.maxHp} · tarcza ${p1.shield}.`,
  ].join("\n");
}

function resultLine(winner: PlayerId): string {
  return `Zwycięzca: ${playerLabelPl(winner)}.`;
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
    resultLine: resultLine(end.winner),
    legalNow: { activePlayerId: "", count: 0, options: [] },
    humanAs: sess.humanAs,
  });
  setTimeout(() => resetSessionForNextMatch(sess), 2800);
}

function botTick(sess: Session) {
  if (checkWinCondition(sess.state).status === "ended") {
    broadcastEnded(sess);
    return;
  }
  if (sess.humanAs && sess.state.activePlayerId === sess.humanAs) return;

  const acts = getValidActions(sess.state);
  if (acts.length === 0) return;

  const before = sess.state;
  const action = pickGreedyAction(before);
  let value = acts.findIndex((v) => actionsEqual(v, action));
  if (value < 0) value = 0;
  const chosen = acts[value]!;
  sess.state = applyAction(before, chosen);
  sess.seq += 1;

  broadcast(sess, {
    type: "step",
    actor: "bot",
    action: chosen,
    summary: summarizeAction(before, chosen),
    state: sess.state,
    stepIndex: sess.seq,
    matchNumber: sess.matchNumber,
    legalBeforeStep: legalPayload(before),
    legalNow: legalPayload(sess.state),
    narrative: narrativeSnapshot(sess.state),
    humanAs: sess.humanAs,
  });

  if (checkWinCondition(sess.state).status === "ended") {
    broadcastEnded(sess);
  }
}

function startBot(sess: Session) {
  stopBot(sess);
  if (sess.botPaused) return;
  const ms = clampDelay(sess.botDelayMs);
  sess.botTimer = setInterval(() => botTick(sess), ms);
}

function resetSessionForNextMatch(sess: Session) {
  sess.matchNumber += 1;
  sess.matchSeed = (sess.matchSeed + 7919 + Math.floor(Math.random() * 997)) >>> 0;
  sess.seq = 0;
  sess.state = createInitialState(sess.matchSeed);
  broadcast(sess, {
    type: "snapshot",
    state: sess.state,
    matchSeed: sess.matchSeed,
    matchNumber: sess.matchNumber,
    message: `Nowa partia (#${sess.matchNumber}).`,
    botDelayMs: sess.botDelayMs,
    botPaused: sess.botPaused,
    legalNow: legalPayload(sess.state),
    humanAs: sess.humanAs,
    narrative: narrativeSnapshot(sess.state),
  });
  startBot(sess);
}

function sessionPayload(sess: Session) {
  const end = checkWinCondition(sess.state);
  return {
    id: sess.id,
    matchSeed: sess.matchSeed,
    matchNumber: sess.matchNumber,
    turnIndex: sess.state.turnIndex,
    activePlayerId: sess.state.activePlayerId,
    ended: end.status === "ended",
    p0Hp: sess.state.units.p0.hp,
    p1Hp: sess.state.units.p1.hp,
    spectators: sess.clients.size,
    botRunning: sess.botTimer != null,
    botPaused: sess.botPaused,
    botDelayMs: sess.botDelayMs,
    humanAs: sess.humanAs,
    contentVersion: sess.state.contentVersion,
  };
}

function createSession(
  seed: number | undefined,
  autoPlay: boolean,
  humanAs: PlayerId | null | undefined,
): Session {
  const matchSeed = seed ?? ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  const id = makeId();
  const sess: Session = {
    id,
    matchSeed,
    seq: 0,
    state: createInitialState(matchSeed),
    botTimer: null,
    clients: new Set(),
    botDelayMs: clampDelay(DEFAULT_BOT_MS),
    botPaused: false,
    matchNumber: 1,
    humanAs: humanAs === "p0" || humanAs === "p1" ? humanAs : null,
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
  };
}

function attachClient(sess: Session, ws: WebSocket) {
  sess.clients.add(ws);
  ws.send(JSON.stringify({ type: "snapshot", ...snapshotFields(sess) }));
  ws.on("close", () => {
    sess.clients.delete(ws);
  });
}

function parseAction(body: unknown): GameAction | null {
  const a = body && typeof body === "object" ? (body as { action?: unknown }).action : undefined;
  if (!a || typeof a !== "object" || typeof (a as { type?: unknown }).type !== "string") return null;
  const t = (a as { type: string }).type;
  if (t === "END_TURN") return { type: "END_TURN" };
  if (t === "STRIKE") return { type: "STRIKE" };
  if (t === "WARD") return { type: "WARD" };
  if (t === "MOVE" && typeof (a as { dir?: unknown }).dir === "string") {
    const d = (a as { dir: string }).dir;
    if (d === "n" || d === "e" || d === "s" || d === "w") return { type: "MOVE", dir: d };
  }
  return null;
}

const app = express();
app.use(express.json());

app.get("/api/meta", (_req, res) => {
  const s = createInitialState(0);
  res.json({
    service: "scarlet-oath-ws",
    genre: s.genre,
    gameId: s.gameId,
    contentVersion: s.contentVersion,
    grid: s.grid,
    rulesPl: {
      apPerTurn: AP_PER_TURN,
      strikeDamage: STRIKE_DAMAGE,
      labels: { p0: "Seeker", p1: "Echo" },
    },
  });
});

app.get("/api/meta/changelog", (_req, res) => {
  try {
    const yaml = fs.readFileSync(CHANGELOG_PATH, "utf8");
    res.type("text/yaml; charset=utf-8").send(yaml);
  } catch {
    res.status(404).json({ error: "changelog_missing" });
  }
});

app.get("/api/sessions", (_req, res) => {
  res.json({ sessions: [...sessions.values()].map(sessionPayload) });
});

app.post("/api/sessions", (req, res) => {
  const seed = typeof req.body?.seed === "number" ? req.body.seed : undefined;
  const autoPlay = req.body?.autoPlay !== false;
  const delayMs = typeof req.body?.botDelayMs === "number" ? req.body.botDelayMs : undefined;
  const humanRaw = req.body?.humanAs;
  const humanAs = humanRaw === "p0" || humanRaw === "p1" ? humanRaw : null;
  const sess = createSession(seed, false, humanAs);
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

/** FORGE: lista legalnych akcji dla aktywnego gracza (jak GET .../valid-actions w planie). */
app.get("/api/sessions/:id/valid-actions", (req, res) => {
  const sess = sessions.get(req.params.id);
  if (!sess) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (checkWinCondition(sess.state).status === "ended") {
    res.json({ ended: true, legal: legalPayload(sess.state) });
    return;
  }
  res.json({ ended: false, legal: legalPayload(sess.state) });
});

app.post("/api/sessions/:id/action", (req, res) => {
  const sess = sessions.get(req.params.id);
  if (!sess) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const action = parseAction(req.body);
  if (!action) {
    res.status(400).json({ error: "invalid_body", hint: "{ action: MOVE|STRIKE|WARD|END_TURN }" });
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

  broadcast(sess, {
    type: "step",
    actor: "human",
    action,
    summary: summarizeAction(before, action),
    state: sess.state,
    stepIndex: sess.seq,
    matchNumber: sess.matchNumber,
    legalBeforeStep: legalPayload(before),
    legalNow: legalPayload(sess.state),
    narrative: narrativeSnapshot(sess.state),
    humanAs: sess.humanAs,
  });

  if (checkWinCondition(sess.state).status === "ended") {
    broadcastEnded(sess);
  }

  res.json({ ok: true, seq: sess.seq });
});

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
    message: sess.humanAs ? `Sterowanie: człowiek jako ${sess.humanAs}.` : "Oba gracze: bot (greedy).",
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
  stopBot(sess);
  startBot(sess);
  broadcast(sess, {
    type: "snapshot",
    ...snapshotFields(sess),
    message: "Ustawienia bota zaktualizowane.",
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
  console.log(`[scarlet-oath] http://127.0.0.1:${PORT}`);
  const demo = createSession(undefined, true, null);
  console.log(`[scarlet-oath] demo session ${demo.id}`);
});

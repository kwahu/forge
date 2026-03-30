/** @typedef {{ id: string, labelPl: string, hintPl: string }} BotStrategyRow */

function $(id) {
  return document.getElementById(id);
}

let ws = null;
let sessionId = null;
let logLines = 0;
const MAX_LOG = 100;
let humanAsLocal = null;
let humanActionPending = false;
let gameOngoing = true;
let lastStratP0 = "spike";
let lastStratP1 = "aggro";

function wsBase() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}`;
}

function pushLog(line) {
  const el = $("log");
  const t = new Date().toLocaleTimeString();
  el.textContent += `[${t}] ${line}\n`;
  logLines++;
  if (logLines > MAX_LOG) {
    const lines = el.textContent.split("\n");
    el.textContent = lines.slice(-MAX_LOG).join("\n");
    logLines = MAX_LOG;
  }
  el.scrollTop = el.scrollHeight;
}

function setLive(ok, text) {
  const pill = $("livePill");
  const dot = $("liveDot");
  pill.classList.remove("ok", "bad");
  if (ok === true) pill.classList.add("ok");
  if (ok === false) pill.classList.add("bad");
  $("liveText").textContent = text;
}

function renderBoard(state) {
  const root = $("board");
  root.innerHTML = "";
  const w = state.boardWidth;
  const h = state.boardHeight;
  root.style.gridTemplateColumns = `repeat(${w}, 1fr)`;

  const blockedSet = new Set(state.blocked.map((c) => `${c.x},${c.y}`));
  const unitAt = new Map();
  for (const u of state.units) {
    unitAt.set(`${u.x},${u.y}`, u);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      if (blockedSet.has(`${x},${y}`)) cell.classList.add("blocked");
      const u = unitAt.get(`${x},${y}`);
      if (u) {
        const token = document.createElement("div");
        token.className = `unit ${u.owner}${u.hp <= 0 ? " dead" : ""}`;
        token.textContent = `${u.owner === "p0" ? "B" : "R"}${u.slot}`;
        token.title = `${u.owner} slot ${u.slot} · HP ${u.hp}`;
        cell.appendChild(token);
      }
      root.appendChild(cell);
    }
  }
}

function renderMeta(state, extra) {
  $("metaSession").textContent = `sesja: ${sessionId ?? "—"}`;
  $("metaSeed").textContent = `seed: ${extra.matchSeed ?? state.rngSeed ?? "—"}`;
  $("metaTurn").textContent = `półtura: ${state.halfTurnIndex}`;
  $("metaVersion").textContent = `zasady: ${state.contentVersion ?? "—"}`;
  const badge = $("turnBadge");
  const ap = state.activePlayerId;
  badge.textContent = `Aktywny: ${ap === "p0" ? "Błękit (p0)" : "Bursztyn (p1)"}`;
  badge.classList.remove("active-p0", "active-p1");
  badge.classList.add(ap === "p0" ? "active-p0" : "active-p1");
}

function renderLegal(data, chosenN) {
  const head = $("legalHead");
  const list = $("legalList");
  if (!data || data.count === 0) {
    head.textContent = "Brak legalnych ruchów.";
    list.innerHTML = "";
    return;
  }
  const who = data.activePlayerId === "p0" ? "Błękit" : "Bursztyn";
  const canClick =
    !!humanAsLocal && gameOngoing && data.activePlayerId === humanAsLocal;
  head.textContent = `${who} — ${data.count} opcji`;
  list.innerHTML = "";
  for (const o of data.options) {
    const li = document.createElement("li");
    if (chosenN != null && o.n === chosenN) li.classList.add("legal-chosen");
    li.appendChild(document.createTextNode(`${o.n}. ${o.shortLabel} — ${o.detail}`));
    if (canClick) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "legal-play-btn";
      btn.textContent = "Wykonaj";
      btn.disabled = humanActionPending;
      btn.addEventListener("click", () => submitHuman(o.action, btn));
      li.appendChild(btn);
    }
    list.appendChild(li);
  }
}

async function submitHuman(action, btn) {
  if (!sessionId || humanActionPending) return;
  humanActionPending = true;
  btn.disabled = true;
  try {
    const res = await fetch(`/api/sessions/${sessionId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      pushLog(`Błąd ruchu: ${res.status} ${j.error ?? ""}`);
    }
  } catch (e) {
    pushLog(`Sieć: ${e}`);
  }
  humanActionPending = false;
}

function fillStrategies(rows) {
  const list =
    rows && rows.length
      ? rows
      : [
          { id: "spike", labelPl: "Spike", hintPl: "" },
          { id: "aggro", labelPl: "Agresor", hintPl: "" },
          { id: "turtle", labelPl: "Obrońca", hintPl: "" },
          { id: "random", labelPl: "Losowy", hintPl: "" },
        ];
  for (const selId of ["stratP0", "stratP1"]) {
    const sel = $(selId);
    sel.innerHTML = "";
    for (const r of list) {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.labelPl;
      if (r.hintPl) o.title = r.hintPl;
      sel.appendChild(o);
    }
  }
  $("stratP0").value = lastStratP0;
  $("stratP1").value = lastStratP1;
}

function handleMessage(raw) {
  const msg = JSON.parse(raw.data);

  if (msg.type === "snapshot") {
    gameOngoing = true;
    $("endBanner").classList.add("hidden");
    renderBoard(msg.state);
    renderMeta(msg.state, msg);
    renderLegal(msg.legalNow, null);
    if (msg.message) pushLog(msg.message);
    return;
  }

  if (msg.type === "step") {
    gameOngoing = true;
    const detail =
      msg.actor === "bot" && msg.chosenLegalN != null
        ? `${msg.summary} (opcja #${msg.chosenLegalN}/${msg.legalActionsCount ?? "?"})`
        : msg.summary || "—";
    $("lastMove").textContent = detail;
    renderBoard(msg.state);
    renderMeta(msg.state, msg);
    renderLegal(msg.legalNow, null);
    pushLog(detail);
    return;
  }

  if (msg.type === "ended") {
    gameOngoing = false;
    renderBoard(msg.state);
    renderMeta(msg.state, msg);
    renderLegal(msg.legalNow, null);
    $("endLine").textContent = msg.resultLine || "Koniec.";
    $("endBanner").classList.remove("hidden");
    pushLog(`KONIEC: ${msg.resultLine}`);
  }
}

function connectWs() {
  if (ws) {
    ws.close();
    ws = null;
  }
  setLive(null, "Łączenie…");
  ws = new WebSocket(`${wsBase()}/ws?sessionId=${encodeURIComponent(sessionId)}`);
  ws.onopen = () => setLive(true, "Na żywo");
  ws.onclose = () => setLive(false, "Rozłączono");
  ws.onerror = () => setLive(false, "Błąd WS");
  ws.onmessage = handleMessage;
}

async function createSession(seedOverride) {
  const body = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      autoPlay: true,
      botDelayMs: Number($("delayRange").value),
      botStrategyP0: $("stratP0").value,
      botStrategyP1: $("stratP1").value,
      humanAs: humanAsLocal,
      ...(seedOverride == null ? {} : { seed: seedOverride }),
    }),
  };
  const res = await fetch("/api/sessions", body);
  if (!res.ok) throw new Error("POST session");
  return res.json();
}

async function patchBot() {
  if (!sessionId) return;
  lastStratP0 = $("stratP0").value;
  lastStratP1 = $("stratP1").value;
  await fetch(`/api/sessions/${sessionId}/bot`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      delayMs: Number($("delayRange").value),
      paused: $("btnPause").classList.contains("paused"),
      botStrategyP0: lastStratP0,
      botStrategyP1: lastStratP1,
    }),
  });
}

async function patchHuman() {
  if (!sessionId) return;
  const v = $("humanRole").value;
  humanAsLocal = v === "p0" || v === "p1" ? v : null;
  await fetch(`/api/sessions/${sessionId}/control`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ humanAs: humanAsLocal }),
  });
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const existing = params.get("session");
  const seedRaw = params.get("seed");
  const seed =
    seedRaw != null && seedRaw !== ""
      ? (() => {
          const n = Number(seedRaw);
          if (!Number.isFinite(n)) return null;
          // UINT32 w stylu servera (seed w zasadach jest liczbą JS).
          return n >>> 0;
        })()
      : null;

  try {
    const meta = await fetch("/api/meta").then((r) => r.json());
    fillStrategies(meta.botStrategies);
  } catch {
    fillStrategies(null);
  }

  try {
    if (existing && existing.startsWith("df-")) {
      const check = await fetch(`/api/sessions/${existing}`);
      if (check.ok) {
        sessionId = existing;
      }
    }
    if (!sessionId) {
      const s = await createSession(seed);
      sessionId = s.id;
      history.replaceState(null, "", `?session=${sessionId}`);
    } else {
      await patchBot();
    }
    $("metaSession").textContent = `sesja: ${sessionId}`;
    connectWs();
  } catch (e) {
    setLive(false, "Błąd startu");
    pushLog(String(e));
  }
}

$("delayRange").addEventListener("input", () => {
  $("delayLabel").textContent = `${$("delayRange").value} ms`;
});

let delayDebounce = null;
$("delayRange").addEventListener("change", () => {
  clearTimeout(delayDebounce);
  delayDebounce = setTimeout(() => patchBot(), 200);
});

$("btnPause").addEventListener("click", async () => {
  $("btnPause").classList.toggle("paused");
  await patchBot();
});

$("stratP0").addEventListener("change", () => patchBot());
$("stratP1").addEventListener("change", () => patchBot());

$("humanRole").addEventListener("change", () => patchHuman());

$("btnNewSession").addEventListener("click", async () => {
  if (ws) ws.close();
  sessionId = null;
  try {
    // Nowa sesja bez seed z URL (żeby nie zafiksować powtórek).
    const s = await createSession(null);
    sessionId = s.id;
    history.replaceState(null, "", `?session=${sessionId}`);
    connectWs();
  } catch (e) {
    pushLog(`Nowa sesja: ${e}`);
  }
});

document.addEventListener("DOMContentLoaded", boot);

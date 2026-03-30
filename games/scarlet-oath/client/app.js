function playerLabelPl(pid) {
  return pid === "p0" ? "Seeker" : "Echo";
}

let ws = null;
let currentSessionId = null;
let humanAsLocal = null;
let gameOngoing = true;
let humanActionPending = false;
let lastMatchNumber = 1;
let pausedUi = false;
let patchTimer = null;
let contentVersion = "";

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

function escapeHtml(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function setLive(on, text) {
  $("liveDot").classList.toggle("live", on);
  $("liveText").textContent = text;
}

function syncHumanRoleUi() {
  const sel = $("humanRole");
  const v = humanAsLocal == null ? "" : humanAsLocal;
  if (sel.value !== v) sel.value = v;
}

function renderGrid(state) {
  const host = $("grid");
  host.innerHTML = "";
  const { width, height } = state.grid;
  host.style.gridTemplateColumns = `repeat(${width}, 48px)`;
  const posP0 = state.positions.p0;
  const posP1 = state.positions.p1;
  const active = state.activePlayerId;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      let token = "";
      if (x === posP0.x && y === posP0.y) {
        token = "◆";
        cell.classList.add("token-p0");
        if (active === "p0") cell.classList.add("active-p0");
      } else if (x === posP1.x && y === posP1.y) {
        token = "◇";
        cell.classList.add("token-p1");
        if (active === "p1") cell.classList.add("active-p1");
      }
      cell.textContent = token;
      host.appendChild(cell);
    }
  }
}

function renderBars(state) {
  const u0 = state.units.p0;
  const u1 = state.units.p1;
  $("barP0").style.width = `${(100 * u0.hp) / u0.maxHp}%`;
  $("barP1").style.width = `${(100 * u1.hp) / u1.maxHp}%`;
  $("statP0").textContent = `HP ${u0.hp}/${u0.maxHp} · tarcza ${u0.shield}${state.activePlayerId === "p0" ? ` · AP ${u0.ap}` : ""}`;
  $("statP1").textContent = `HP ${u1.hp}/${u1.maxHp} · tarcza ${u1.shield}${state.activePlayerId === "p1" ? ` · AP ${u1.ap}` : ""}`;
}

function narrativeFromState(state) {
  const { p0, p1 } = state.units;
  return [
    `Tura ${state.turnIndex} · aktywny ${playerLabelPl(state.activePlayerId)}.`,
    `Seeker HP ${p0.hp}/${p0.maxHp} · tarcza ${p0.shield} | Echo HP ${p1.hp}/${p1.maxHp} · tarcza ${p1.shield}.`,
  ].join("\n");
}

function renderState(state, extraLine) {
  renderGrid(state);
  renderBars(state);
  $("narrative").textContent = extraLine || narrativeFromState(state);
}

function renderLegalOptions(data, highlightN) {
  const listEl = $("legalNowList");
  const headEl = $("legalNowHead");
  if (!data || data.count === 0) {
    headEl.textContent = "Brak legalnych ruchów.";
    listEl.innerHTML = "";
    return;
  }
  const canClick =
    !!humanAsLocal && gameOngoing && data.activePlayerId === humanAsLocal;
  const who = playerLabelPl(data.activePlayerId);
  headEl.textContent = `${who} — ${data.count} opcji${canClick ? " (Wykonaj przy swojej turze)" : ""}`;
  listEl.innerHTML = "";
  const ol = document.createElement("ol");
  ol.className = "legal-list";
  for (const o of data.options) {
    const li = document.createElement("li");
    if (highlightN != null && o.n === highlightN) li.style.background = "rgba(212,165,116,0.08)";
    const main = document.createElement("div");
    main.style.flex = "1";
    main.innerHTML = `<span class="legal-n mono">${o.n}.</span> <span class="legal-short">${escapeHtml(o.shortLabel)}</span><span class="legal-detail">${escapeHtml(o.detail)}</span>`;
    li.appendChild(main);
    if (canClick) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "legal-play-btn";
      btn.textContent = "Wykonaj";
      btn.disabled = humanActionPending;
      btn.addEventListener("click", () => submitHumanAction(o.action, btn));
      li.appendChild(btn);
    }
    ol.appendChild(li);
  }
  listEl.appendChild(ol);
}

async function submitHumanAction(action, btn) {
  if (!currentSessionId || humanActionPending) return;
  humanActionPending = true;
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(currentSessionId)}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      $("lastAction").textContent = j.error || res.statusText || "Błąd akcji";
    }
  } catch (e) {
    $("lastAction").textContent = String(e.message);
  } finally {
    humanActionPending = false;
  }
}

async function patchHumanControl(value) {
  if (!currentSessionId) return;
  const humanAs = value === "" ? null : value;
  await fetch(`/api/sessions/${encodeURIComponent(currentSessionId)}/control`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ humanAs }),
  });
}

async function patchBot(body) {
  if (!currentSessionId) return;
  await fetch(`/api/sessions/${encodeURIComponent(currentSessionId)}/bot`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function handleWsMessage(msg) {
  if (msg.humanAs !== undefined) humanAsLocal = msg.humanAs;
  syncHumanRoleUi();

  if (msg.type === "snapshot") {
    gameOngoing = true;
    $("winnerBanner").classList.add("hidden");
    if (msg.matchNumber != null) {
      lastMatchNumber = msg.matchNumber;
      $("matchBadge").textContent = `Partia #${lastMatchNumber}`;
    }
    renderState(msg.state);
    renderLegalOptions(msg.legalNow, null);
    $("lastAction").textContent = msg.message || "";
    setLive(true, "Połączono (WS)");
  }

  if (msg.type === "step") {
    gameOngoing = true;
    renderState(msg.state);
    renderLegalOptions(msg.legalNow, null);
    const who = msg.actor === "human" ? "Ty" : "Bot";
    $("lastAction").textContent = `${who}: ${msg.summary || ""}`;
  }

  if (msg.type === "ended") {
    gameOngoing = false;
    if (msg.matchNumber != null) {
      lastMatchNumber = msg.matchNumber;
      $("matchBadge").textContent = `Partia #${lastMatchNumber}`;
    }
    renderState(msg.state, narrativeFromState(msg.state));
    renderLegalOptions(msg.legalNow, null);
    $("winnerLine").textContent = msg.resultLine || `Zwycięzca: ${playerLabelPl(msg.winner)}`;
    $("winnerBanner").classList.remove("hidden");
  }
}

function connectWs(sessionId) {
  if (ws) {
    ws.close();
    ws = null;
  }
  currentSessionId = sessionId;
  humanAsLocal = $("humanRole").value === "" ? null : $("humanRole").value;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${location.host}/ws?sessionId=${encodeURIComponent(sessionId)}`;
  ws = new WebSocket(url);
  ws.onopen = () => setLive(true, "Połączono (WS)");
  ws.onclose = () => setLive(false, "Rozłączono");
  ws.onerror = () => setLive(false, "Błąd WS");
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      handleWsMessage(msg);
    } catch {
      /* ignore */
    }
  };
}

async function loadMeta() {
  const r = await fetch("/api/meta");
  const j = await r.json();
  contentVersion = j.contentVersion || "";
  $("versionBadge").textContent = contentVersion ? `content ${contentVersion}` : "";
}

async function refreshSessions(selectId) {
  const r = await fetch("/api/sessions");
  const j = await r.json();
  const ul = $("sessionList");
  ul.innerHTML = "";
  for (const s of j.sessions) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.sid = s.id;
    const pauseTag = s.botPaused ? " ⏸" : "";
    const hum = s.humanAs ? ` · H:${s.humanAs}` : "";
    b.textContent = `${s.id.slice(0, 12)}… · #${s.matchNumber} · HP ${s.p0Hp}/${s.p1Hp} · 👁${s.spectators}${s.botRunning ? " · bot" : ""}${hum}${pauseTag}`;
    b.classList.toggle("active", s.id === selectId || s.id === currentSessionId);
    b.addEventListener("click", () => connectWs(s.id));
    li.appendChild(b);
    ul.appendChild(li);
  }
  return j.sessions;
}

async function ensureSession() {
  let sessions = (await refreshSessions()).slice();
  if (sessions.length === 0) {
    const hr = $("humanRole").value;
    const cr = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        autoPlay: true,
        humanAs: hr === "" ? null : hr,
        botDelayMs: Number($("delayRange").value),
      }),
    });
    const created = await cr.json();
    await refreshSessions(created.id);
    return created.id;
  }
  return sessions[0].id;
}

$("btnRefresh").addEventListener("click", () => refreshSessions());

$("btnNew").addEventListener("click", async () => {
  const delay = Number($("delayRange").value);
  const hr = $("humanRole").value;
  const cr = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      autoPlay: true,
      botDelayMs: delay,
      humanAs: hr === "" ? null : hr,
    }),
  });
  const created = await cr.json();
  await refreshSessions(created.id);
  connectWs(created.id);
});

$("delayRange").addEventListener("input", () => {
  const v = Number($("delayRange").value);
  $("delayLabel").textContent = `${v} ms`;
  if (patchTimer) clearTimeout(patchTimer);
  patchTimer = setTimeout(() => {
    patchTimer = null;
    patchBot({ delayMs: v });
  }, 320);
});

$("btnPause").addEventListener("click", async () => {
  pausedUi = !pausedUi;
  await patchBot({ paused: pausedUi });
  $("btnPause").textContent = pausedUi ? "Wznów" : "Pauza";
});

$("humanRole").addEventListener("change", async () => {
  const v = $("humanRole").value;
  humanAsLocal = v === "" ? null : v;
  await patchHumanControl(v);
});

async function init() {
  setLive(false, "Start…");
  await loadMeta();
  const sid = await ensureSession();
  await refreshSessions(sid);
  connectWs(sid);
  setInterval(() => refreshSessions(), 8000);
}

init().catch((e) => {
  console.error(e);
  $("lastAction").textContent = "Błąd: " + e.message;
});

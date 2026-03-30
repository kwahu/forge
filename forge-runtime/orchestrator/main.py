"""
Local FORGE orchestrator: kolejka zadań, pliki inbox/outbox, bez nadpisywania src/ bez jawnego polecenia.
Uruchomienie: python -m orchestrator.main (z katalogu forge-runtime)
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path

from orchestrator.state import OrchestratorState, TaskRecord, load_state, save_state, _utc_now


def _repo_root(cfg: dict) -> Path:
    raw = cfg.get("repo_root", "..")
    return (Path(__file__).resolve().parent.parent / raw).resolve()


def _load_config(base: Path) -> dict:
    cfg_path = base / "config.json"
    example = base / "config.example.json"
    if cfg_path.exists():
        with cfg_path.open(encoding="utf-8") as f:
            return json.load(f)
    if example.exists():
        with example.open(encoding="utf-8") as f:
            return json.load(f)
    return {"poll_interval_seconds": 5, "repo_root": "..", "allowed_shell_prefixes": []}


def _shell_allowed(cmd: str, prefixes: list[str]) -> bool:
    c = cmd.strip()
    if not c:
        return False
    return any(c.startswith(p) for p in prefixes)


def _ingest_inbox(inbox: Path, state: OrchestratorState, processed: Path) -> None:
    inbox.mkdir(parents=True, exist_ok=True)
    processed.mkdir(parents=True, exist_ok=True)
    for path in sorted(inbox.glob("*.json")):
        try:
            with path.open(encoding="utf-8") as f:
                raw = json.load(f)
        except json.JSONDecodeError as e:
            err = processed / f"{path.stem}_INVALID.json"
            shutil.move(str(path), str(err))
            (processed / f"{path.stem}_ERROR.txt").write_text(str(e), encoding="utf-8")
            continue

        tid = raw.get("id") or f"task-{uuid.uuid4().hex[:12]}"
        if tid in state.tasks:
            tid = f"{tid}-{uuid.uuid4().hex[:6]}"

        task = TaskRecord(
            id=tid,
            type=raw.get("type", "handoff"),
            payload=raw.get("payload") or {},
            status="queued",
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        state.tasks[tid] = task
        state.task_order.append(tid)
        dest = processed / path.name
        if dest.exists():
            dest = processed / f"{path.stem}_{uuid.uuid4().hex[:6]}.json"
        shutil.move(str(path), str(dest))


def _run_shell(task: TaskRecord, cfg: dict, outbox: Path, repo: Path) -> Path:
    cmd = (task.payload.get("command") or "").strip()
    prefixes = cfg.get("allowed_shell_prefixes") or []
    if not _shell_allowed(cmd, prefixes):
        raise ValueError(
            f"Komenda niedozwolona lub pusta. Dozwolone prefiksy: {prefixes}. Dostałem: {cmd!r}"
        )
    log_path = outbox / f"run_{task.id}.log"
    proc = subprocess.run(
        cmd,
        shell=True,
        cwd=str(repo),
        capture_output=True,
        text=True,
        timeout=int(task.payload.get("timeout_seconds") or 600),
    )
    body = (
        f"exit_code: {proc.returncode}\n\n--- stdout ---\n{proc.stdout}\n\n--- stderr ---\n{proc.stderr}"
    )
    log_path.write_text(body, encoding="utf-8")
    if proc.returncode != 0:
        raise RuntimeError(f"shell exit {proc.returncode}, zobacz {log_path.name}")
    return log_path


def _run_llm(task: TaskRecord, cfg: dict, outbox: Path) -> Path:
    llm = cfg.get("llm") or {}
    if not llm.get("enabled"):
        raise RuntimeError('LLM wyłączone — ustaw "llm.enabled": true w config.json i ANTHROPIC_API_KEY w .env')

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("Brak ANTHROPIC_API_KEY w środowisku")

    try:
        import urllib.request
    except ImportError:
        raise RuntimeError("urllib niedostępny") from None

    prompt = task.payload.get("prompt") or ""
    if not prompt.strip():
        raise ValueError("payload.prompt jest wymagany dla type=llm")

    model = llm.get("model", "claude-sonnet-4-20250514")
    max_tokens = int(llm.get("max_tokens", 4096))

    body = json.dumps(
        {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    text_parts = []
    for block in data.get("content", []):
        if block.get("type") == "text":
            text_parts.append(block.get("text", ""))
    out = "\n".join(text_parts)
    out_path = outbox / f"llm_{task.id}.md"
    out_path.write_text(out, encoding="utf-8")
    return out_path


def _run_handoff(task: TaskRecord, outbox: Path) -> Path:
    """Tylko zapisuje spec dla Ciebie / Cursor — zero edycji repo."""
    title = task.payload.get("title") or task.id
    body = task.payload.get("body") or ""
    path = outbox / f"HANDOFF_{task.id}.md"
    content = f"# Handoff: {title}\n\n{body}\n"
    path.write_text(content, encoding="utf-8")
    return path


def _run_write_artifact(task: TaskRecord, outbox: Path, repo: Path) -> Path:
    """
    Zapis pliku pod ścieżką względem repo — tylko jeśli mieści się w allow_prefixes.
    Użyj, gdy świadomie chcesz, żeby orchestrator pisał w drzewie projektu.
    """
    rel = (task.payload.get("path") or "").replace("\\", "/").strip()
    if not rel or ".." in rel.split("/"):
        raise ValueError("Nieprawidłowa ścieżka path")

    allow = task.payload.get("allow_prefixes") or ["forge-runtime/outbox/", "docs/"]
    if not any(rel.startswith(p) for p in allow):
        raise ValueError(f"path musi zaczynać się od jednego z: {allow}")

    full = (repo / rel).resolve()
    if not str(full).startswith(str(repo)):
        raise ValueError("path poza repo")

    full.parent.mkdir(parents=True, exist_ok=True)
    content = task.payload.get("content")
    if content is None:
        raise ValueError("payload.content wymagany")
    full.write_text(str(content), encoding="utf-8", newline="\n")
    return full


def _process_one(task: TaskRecord, cfg: dict, outbox: Path, repo: Path) -> Path | None:
    t = task.type
    if t == "shell":
        return _run_shell(task, cfg, outbox, repo)
    if t == "llm":
        return _run_llm(task, cfg, outbox)
    if t == "handoff":
        return _run_handoff(task, outbox)
    if t == "write_artifact":
        return _run_write_artifact(task, outbox, repo)
    if t == "noop":
        p = outbox / f"noop_{task.id}.txt"
        p.write_text("noop\n", encoding="utf-8")
        return p
    raise ValueError(f"Nieznany type: {t}")


def run_loop(base: Path | None = None) -> None:
    base = base or Path(__file__).resolve().parent.parent
    cfg = _load_config(base)
    interval = float(cfg.get("poll_interval_seconds", 5))
    repo = _repo_root(cfg)

    inbox = base / "inbox"
    outbox = base / "outbox"
    processed = base / "inbox" / "processed"
    state_path = base / "state" / "orchestrator.json"
    outbox.mkdir(parents=True, exist_ok=True)

    print(f"[forge-orchestrator] repo_root={repo}", flush=True)
    print(f"[forge-orchestrator] inbox={inbox}", flush=True)
    print("[forge-orchestrator] Press Ctrl+C to stop", flush=True)

    while True:
        state = load_state(state_path)
        _ingest_inbox(inbox, state, processed)

        next_id = None
        for tid in state.task_order:
            tr = state.tasks.get(tid)
            if tr and tr.status == "queued":
                next_id = tid
                break

        if next_id:
            task = state.tasks[next_id]
            task.status = "running"
            task.updated_at = _utc_now()
            save_state(state_path, state)
            try:
                result = _process_one(task, cfg, outbox, repo)
                task.status = "done"
                task.result_path = str(result) if result else None
                task.error = None
            except Exception as e:
                task.status = "failed"
                task.error = str(e)
                err_file = outbox / f"ERROR_{task.id}.txt"
                err_file.write_text(str(e), encoding="utf-8")
                task.result_path = str(err_file)
            task.updated_at = _utc_now()
            save_state(state_path, state)

        time.sleep(interval)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    # Opcjonalnie wczytaj .env z forge-runtime (bez zewnętrznej zależności)
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
            if m:
                k, v = m.group(1), m.group(2).strip().strip('"').strip("'")
                os.environ.setdefault(k, v)

    try:
        run_loop()
    except KeyboardInterrupt:
        print("\n[forge-orchestrator] stopped.", flush=True)
        sys.exit(0)


if __name__ == "__main__":
    main()

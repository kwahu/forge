from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class TaskRecord:
    id: str
    type: str
    payload: dict[str, Any]
    status: str  # queued | running | done | failed | blocked
    created_at: str
    updated_at: str
    error: str | None = None
    result_path: str | None = None


@dataclass
class OrchestratorState:
    version: int = 1
    tasks: dict[str, TaskRecord] = field(default_factory=dict)
    task_order: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "tasks": {k: asdict(v) for k, v in self.tasks.items()},
            "task_order": list(self.task_order),
        }

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> OrchestratorState:
        tasks = {}
        for tid, t in data.get("tasks", {}).items():
            tasks[tid] = TaskRecord(**t)
        return cls(
            version=data.get("version", 1),
            tasks=tasks,
            task_order=list(data.get("task_order", [])),
        )


def load_state(path: Path) -> OrchestratorState:
    if not path.exists():
        return OrchestratorState()
    with path.open(encoding="utf-8") as f:
        return OrchestratorState.from_json(json.load(f))


def save_state(path: Path, state: OrchestratorState) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(state.to_json(), f, indent=2, ensure_ascii=False)
    tmp.replace(path)

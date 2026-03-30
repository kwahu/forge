# FORGE — lokalny orchestrator (runtime)

Działa tylko gdy go uruchomisz (`python -m orchestrator` z tego katalogu). **Nie koliduje** z równoczesną pracą w Cursorze, o ile trzymasz się konwencji poniżej.

## Podział: co robi Cursor (asystent w IDE), a co orchestrator

| | **Cursor (ja w czacie)** | **Orchestrator (ten proces)** |
|---|---|---|
| **Rola** | Projektowanie, refaktory, wyjaśniania, edycja wielu plików z pełnym kontekstem IDE, decyzje „jak to zrobić”. | Kolejka zadań, powtarzalne kroki, logi z komend, opcjonalnie wywołania LLM w tle, **handoffy** jako pliki do Ciebie. |
| **Kod produktu** (`src/`, silnik gry, itd.) | **Preferowany autor** — Ty edytujesz z asystentem; mniej ryzyka merge conflictów. | **Domyślnie nie dotyka**. Może zapisać artefakt tylko przez zadanie `write_artifact` z jawną listą `allow_prefixes` (np. tylko `docs/`). |
| **Testy / build** | Uruchamiasz na żądanie. | Może cyklicznie odpalać **whitelisted** komendy (`shell`), wynik → `outbox/*.log`. |
| **Stan kolejki** | Możesz czytać `state/orchestrator.json`. | **Wyłączny zapis** — nie edytuj tego pliku ręcznie przy włączonym orchestratorze. |

## Jak się komunikujecie (bez blokowania się nawzajem)

1. **Ty → orchestrator:** wrzucasz plik JSON do `forge-runtime/inbox/*.json` (np. skopiuj z `examples/`). Orchestrator **przenosi** go do `inbox/processed/` i dopisuje zadanie do kolejki.
2. **Orchestrator → Ty / Cursor:** wyniki w `forge-runtime/outbox/`:
   - `HANDOFF_*.md` — spec do wklejenia w czat lub do przeczytania; **implementacja w Cursorze**.
   - `run_*.log` — stdout/stderr z komendy.
   - `llm_*.md` — odpowiedź modelu (jeśli włączysz LLM).
3. **Równoległa praca:** edytujesz projekt normalnie. Unikaj jednoczesnej edycji **tych samych plików**, które orchestrator zapisuje (`state/`, pliki w `outbox/` które Ty też zmieniasz). **Nie commituj konfliktów:** orchestrator nie powinien dotykać plików nad którymi akurat pracujesz, jeśli nie używasz `write_artifact` pod `src/`.

**Zasada antykolizyjna:** orchestrator **nie zapisuje** pod `src/` ani pod innymi krytycznymi ścieżkami, dopóki nie dodasz jawnego zadania `write_artifact` z ostrożnym `allow_prefixes`. Domyślnie traktuj go jako „kolejka + logi + handoffy”, a kod piszesz w Cursorze.

## Uruchomienie (Windows)

```powershell
cd d:\FORGE\forge-runtime
copy config.example.json config.json
python -m orchestrator
```

Opcjonalnie LLM w tle: w `config.json` ustaw `"llm": { "enabled": true, ... }` i utwórz `.env` z `ANTHROPIC_API_KEY=...`.

## Typy zadań (`type` w JSON w inbox)

| `type` | Działanie |
|---|---|
| `handoff` | Tworzy `outbox/HANDOFF_<id>.md` — **zero zmian w repo poza forge-runtime/outbox**. |
| `shell` | Uruchamia komendę z CWD = root repo (`repo_root` w config); musi pasować do `allowed_shell_prefixes`. |
| `llm` | Wysyła `payload.prompt` do Anthropic; wynik → `outbox/llm_*.md`. |
| `write_artifact` | Zapisuje plik w repo tylko pod prefiksami z `payload.allow_prefixes`. |
| `noop` | Test kolejki. |

Opcjonalnie `"id": "moje-zadanie"` w JSON — inaczej wygeneruje się automatycznie.

## Śledzenie rozwoju gry (Rift Duel)

- **GDD i fabuła:** `games/rift-duel/docs/GDD.md`
- **Historia decyzji (changelog koncepcji):** `games/rift-duel/docs/DESIGN_HISTORY.md`
- **Skrót dla agentów:** `games/rift-duel/docs/MANIFEST.md`
- **Backlog zadań:** `games/rift-duel/docs/BACKLOG.yaml`

Workflow FORGE: asystent aktualizuje dokumenty + kod; orchestrator co jakiś czas odpala `npm run test:rift-duel` / `sim` — wyniki w `outbox/run_*.log`.

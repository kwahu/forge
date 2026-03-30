# FORGE — Framework for Orchestrated Recursive Game Evolution

FORGE to *genre-agnostic* framework do iteracyjnego tworzenia gier turowych: projekt → implementacja → testy/grywalność → feedback → decyzje, aż do stabilnej jakości. Gra jest traktowana jako usługa z API, a każdy tytuł istnieje jako niezależny moduł zasad (Rules Module) podpinany do wspólnego silnika/warstwy pracy.

## Co jest w repo

- `forge-runtime/` — runtime orkiestratora (kolejka zadań, handoffy, uruchamianie whitelistowanych komend, logi i artefakty)
- `games/` — poszczególne gry (każda ma własny `package.json`, testy i skrypty)
- `FORGE_MASTER_PLAN.md` — kompletna spec procesu i architektury
- `.cursor/rules/` — reguły procesu (np. quorum, design lock, anty-drift)

## Szybki start: uruchomienie gry

Przykład dla `rift-duel`:

```powershell
npm --prefix games/rift-duel install
npm --prefix games/rift-duel run server
```

Inne gry:

- `games/deepspire`: `npm --prefix games/deepspire run server`
- `games/drift-front`: `npm --prefix games/drift-front run server`
- `games/scarlet-oath`: `npm --prefix games/scarlet-oath run server`

Testy:

```powershell
npm --prefix games/rift-duel test
npm --prefix games/deepspire test
npm --prefix games/drift-front test
npm --prefix games/scarlet-oath test
```

## Runtime orkiestratora (opcjonalnie)

Jeśli chcesz korzystać z `forge-runtime`:

```powershell
cd d:\FORGE\forge-runtime
copy config.example.json config.json
python -m orchestrator
```

Runtime wykorzystuje katalogi:

- `inbox/` — wejście zadań (z JSON)
- `outbox/` — wyjście (np. `HANDOFF_*.md`, logi z komendami)

## Notatki

- Unikaj commita sekretów — `.gitignore` filtruje m.in. `.env*` oraz pliki kluczy (`.pem`, `.key`).
- Projekt stawia na deterministyczne rozgrywki i replay (seeded RNG), więc zmiany core loop warto walidować regresjami/goldenami w odpowiednich grach.


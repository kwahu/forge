# Historia designu — Front Dryfu

Skrót decyzji (FORGE: spójność z MANIFEST i wersją pakietu).

## 2026-03-30 — v0.2.1 (balans AI, bez zmiany zasad planszy)

- **Problem:** `turtle` w macierzy matchupów nie wchodził w kontakt z `spike`/`aggro` → remis na limicie 512 półtur.
- **Zmiana:** `pickTurtle` — przy dystansie bitewnym **≥ 3** (minimalna Manhattan między dowolną parą własna–wróg) używa **Agresora** (zbliżanie); przy **HP ≤ 2** zostaje ucieczka / dobijanie / fallback Spike; inaczej **Spike** w walce w zwarciu.
- **Wynik:** `turtle` vs `spike` kończy się wyraźną wygraną w próbach; **turtle vs turtle** nadal często remisuje (symetria + ta sama heurystyka) — zapisane w `BACKLOG.yaml` jako **DF-BOT-001**.
- **Regresja:** `tests/golden-seeds.test.ts` — spike vs aggro (5 seedów) + smoke turtle vs spike (seed 42).

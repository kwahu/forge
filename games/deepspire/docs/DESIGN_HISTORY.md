# Deepspire — historia decyzji (skrót)

| Data | Wersja | Zmiana |
|------|--------|--------|
| 2026-03-30 | 0.1.x | MVP rules module: siatka, schody, 3 poziomy, bot heurystyczny, `DESCEND` priorytet nad ruchem na polu schodów. |
| 2026-03-30 | 0.2.0 | Vertical slice produktu (§6.4 FORGE): Express + WebSocket + klient statyczny; tryb obserwacji bota vs gra ludzka; meta `/api/meta`; domyślna sesja demo na starcie serwera. |
| 2026-03-30 | 0.2.1 | Lista legalnych akcji: sekcje „Schody i czekanie” / „Ruch”, tryb kompaktowy (localStorage). Wyzwanie dnia: `challengeDay` w `/api/meta`, `src/challengeDay.ts`, przycisk w kliencie. Regresja: `npm run playtest:golden` + `tests/golden-bot.test.ts`. |

**Pierwsza sesja (demo):** serwer uruchamia sesję tylko-bot; klient tworzy własną sesję po załadowaniu — świadomie dwa wejścia, żeby nie blokować szybkiego podglądu.

# Manifest — Front Dryfu (Drift Front)

| Pole | Wartość |
|------|---------|
| **Tytuł roboczy** | Front Dryfu (Drift Front) |
| **Gatunek** | Strategia turowa 1v1 (siatka, pełna informacja) |
| **Wersja zasad (content)** | 0.2.0 |
| **Wersja kodu (pakiet)** | 0.2.1 |
| **Rdzeń rozgrywki** | Plansza 5×5, **filary (blocked)** na (1,1)/(3,3), 2 jednostki × gracz (5 HP, atak 2), 1 akcja / półtura, eliminacja lub remis po limicie półtur |
| **Stan produktu** | Rules + boty (`spike`/`aggro`/`turtle`/`random`) + macierz + **serwer REST+WS** + **klient obserwatora** + testy |
| **FORGE** | Checklist §6.4: `docs/FORGE_SYNC.md`; domyślne demo AI: Spike vs Aggro |
| **Następny kamień milowy** | DF-BOT-001 (mirror turtle), cele / VP, pierwszy FB `FEEDBACK_FB-DF-001` (BACKLOG DF-FEED-003), challenge dnia DF-UX-004 |
| **Uwagi QA** | Golden seeds: `tests/golden-seeds.test.ts`; mirror **turtle vs turtle** nadal remisowy — zob. `docs/BACKLOG.yaml` |

**Jednozdaniowa wizja:** minimalistyczny duel taktyczny pod pipeline FORGE — szybkie partie, zero losowości w walce, nacisk na pozycję.

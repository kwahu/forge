# Manifest — Szkarłatna przysięga (Scarlet Oath)

*Zwięzły opis aktualnego stanu (FORGE §9.1). Aktualizuj przy każdej istotnej zmianie GDD / kodu.*

| Pole | Wartość |
|------|---------|
| **Tytuł roboczy** | Szkarłatna przysięga (Scarlet Oath) |
| **Gatunek** | RPG taktyczny turowy 1v1 (rules module pod FORGE) |
| **Wersja zasad (content)** | 0.2.0 |
| **Wersja kodu (pakiet)** | 0.3.0 |
| **Rdzeń rozgrywki** | Siatka 6×5, 3 AP/tura, ruch ortogonalny, STRIKE (2 AP, 5 dmg), DASH (2 AP, skok 2 pola), WARD (+4 tarczy, max 10), inicjatywa z seeda; HP 22/22 (balans mirror-AI) |
| **Stan produktu** | Silnik + testy + **golden replay** (2 fixtury: seed42 i seed4) + `npm run balance` + REST/WS + `GET .../valid-actions` + `POST .../undo` + klient; `CHANGELOG.yaml`, `BACKLOG.yaml` |
| **Tożsamość fabularna (zarys)** | Seeker (p0) vs Echo (p1) — pojedynek na pograniczu welwu (szczegóły: GDD §5) |
| **Następny kamień milowy** | PvE fale (SO-001); spectator view (SO-005) |

**Jednozdaniowa wizja:** minimalistyczny duel taktyczny jako moduł RPG pod FORGE — deterministyczny stan, legalne akcje, AI do autotestów, z możliwością rozbudowy o kampanię i narrację.

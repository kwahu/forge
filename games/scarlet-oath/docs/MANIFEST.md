# Manifest — Szkarłatna przysięga (Scarlet Oath)

*Zwięzły opis aktualnego stanu (FORGE §9.1). Aktualizuj przy każdej istotnej zmianie GDD / kodu.*

| Pole | Wartość |
|------|---------|
| **Tytuł roboczy** | Szkarłatna przysięga (Scarlet Oath) |
| **Gatunek** | RPG taktyczny turowy 1v1 (rules module pod FORGE) |
| **Wersja zasad (content)** | 0.1.1 |
| **Wersja kodu (pakiet)** | 0.2.1 |
| **Rdzeń rozgrywki** | Siatka 6×5, 3 AP/tura, ruch ortogonalny, STRIKE (2 AP, 5 dmg), WARD (+4 tarczy, max 10), inicjatywa z seeda; HP 22/22 (balans mirror-AI) |
| **Stan produktu** | Silnik + testy + **golden replay** (`tests/fixtures`) + `npm run balance` + REST/WS + `GET .../valid-actions` + klient; `CHANGELOG.yaml`, `BACKLOG.yaml` |
| **Tożsamość fabularna (zarys)** | Seeker (p0) vs Echo (p1) — pojedynek na pograniczu welwu (szczegóły: GDD §5) |
| **Następny kamień milowy** | PvE fale (SO-001); drugi golden fixture; undo API (BACKLOG) |

**Jednozdaniowa wizja:** minimalistyczny duel taktyczny jako moduł RPG pod FORGE — deterministyczny stan, legalne akcje, AI do autotestów, z możliwością rozbudowy o kampanię i narrację.

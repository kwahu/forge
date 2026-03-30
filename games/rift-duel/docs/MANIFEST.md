# Manifest — Pęknięcie (Rift Duel)

*Zwięzły opis aktualnego stanu (FORGE §9.1). Aktualizuj przy każdej istotnej zmianie GDD / kodu.*

| Pole | Wartość |
|------|---------|
| **Tytuł roboczy** | Pęknięcie (Rift Duel) |
| **Gatunek** | Karciany duel taktyczny 1v1 → docelowo gra PC z kampanią |
| **Wersja zasad (content)** | 0.2.1 |
| **Wersja kodu (pakiet)** | 0.7.3 |
| **Rdzeń rozgrywki** | HP 20, ward, 2 zagrania/tura, dobór 1 po turze, fatigue, seed deterministyczny; **opcjonalne modyfikatory startu** (`extraOpeningDraws` w misji) |
| **Stan produktu** | 0.7.2 + **kampania Arc 1** (`content/campaign.json`, 5 kroków PL + intro w UI); `POST { missionId }`; stan gry z `missionId` |
| **Pilotaż fabularny** | Konflikt „Strażnicy Szczeliny” vs „Rozwarstwienie” (szczegóły: GDD §5) |
| **Następny kamień milowy** | Progresja między krokami (odblokowania), PvP/hotseat, leaderboard globalny; demo / Steam (GDD §7) |

**Jednozdaniowa wizja:** gracz jako mediator szczelin rzeczywistości — duel karty to abstrakcja walki o równowagę; od prototypu rules-module do pełnej gry PC z narracją i trybem wieloosobowym.

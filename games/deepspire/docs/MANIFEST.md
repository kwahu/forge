# Manifest — Deepspire

*Zwięzły opis stanu (FORGE § wersjonowanie / manifest).*

| Pole | Wartość |
|------|---------|
| **Tytuł roboczy** | Deepspire |
| **Gatunek** | Roguelike turowy (1 gracz, grid, permadeath logiczny) |
| **Wersja zasad (content)** | 0.1.0 |
| **Wersja kodu (pakiet)** | 0.2.1 |
| **Rdzeń rozgrywki** | Siatka 11×11, pijany kopacz + schody, ruch 4-kierunkowy, wróg 1–2 HP, zejście z głębokości 3 = wygrana |
| **Stan produktu** | Rules module + testy + `simulate` + `playtest:golden` + **serwer REST/WS** + **klient** (mapa, akcje pogrupowane / kompakt, wyzwanie dnia z `/api/meta`) |
| **Wyzwanie dnia (seed)** | `20260330` — data w etykiecie `2026-03-30`; źródło: `src/challengeDay.ts` (rotacja ręczna + ten wiersz) |
| **Następny kamień milowy** | Ekwipunek, typy wrogów, druga heurystyka bota + macierz (`DS-BOT-002`), API `/api/v1/...`, anty-pętla AI na trudnych seedach |

**Jednozdaniowa wizja:** zbież do serca wieży — każde piętro to deterministyczny loch z seeda; zejdź trzy razy, by zamknąć szczelinę (MVP).

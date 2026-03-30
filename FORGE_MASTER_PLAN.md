# FORGE — Framework for Orchestrated Recursive Game Evolution

## Wizja

FORGE to **genre-agnostic** framework pracy, w którym **Claude (wieloagentowo)** wymyśla, tworzy, testuje, ogrywa i iteracyjnie rozwija **różne typy gier turowych** — strategię, roguelike, przygodówkę, RPG, i inne — od pierwszego pomysłu, aż po dopracowany produkt. 

Silnik jest **platformą do gier turowych**, nie silnikiem jednej gry. Każdy gatunek to osobny **moduł zasad (Rules Module)** podpinany pod ten sam silnik, API, system agentów i UI. Gra istnieje jako **usługa z API**, do której podłącza się zarówno klient UI (dla ludzkiego obserwatora), jak i agenci AI (grający, testujący, recenzujący). Człowiek obserwuje, ocenia i w dowolnym momencie może powiedzieć: „to jest wystarczająco dobre" lub „zmieńcie kierunek".

### Wspierane gatunki gier turowych

| Gatunek | Charakterystyka turowa | Przykładowe mechaniki core |
|---|---|---|
| **Strategia** | Kontrola terenu, zarządzanie zasobami, 2+ graczy | Ruch jednostek, budowanie, dyplomacja |
| **Roguelike** | Eksploracja dungeonu, 1 gracz, proceduralna generacja | Ruch po gridzie, walka, loot, permadeath |
| **Przygodówka** | Eksploracja narracyjna, wybory fabularne, 1 gracz | Dialog trees, inventory puzzles, branching story |
| **RPG** | Rozwój postaci, walka turowa, questy | Drzewko umiejętności, ekwipunek, combat system |
| **Card Game** | Budowanie decku, zagrywanie kart, 1-N graczy | Draw, play, discard, synergie kart |
| **Inne** | Framework pozwala definiować własne gatunki | Dowolne mechaniki turowe via Rules Module |

### Architektura Genre-Agnostic

```
Rules Module Interface:
  - defineGameState(): GameState          — jak wygląda stan gry
  - getValidActions(state): Action[]      — co gracz może zrobić
  - applyAction(state, action): GameState — jak akcja zmienia stan
  - checkWinCondition(state): Result      — czy gra się skończyła
  - getVisibility(state, playerId): View  — co widzi dany gracz
  - getAIContext(state): AIContext         — kontekst dla agentów AI
```

Każdy gatunek implementuje ten interfejs. Silnik, API, session manager, agenci i UI działają identycznie niezależnie od gatunku. UI adaptuje się do gatunku na podstawie metadanych z Rules Module (typ planszy, elementy wizualne, układ interfejsu).

---

## 1. ANATOMIA PROBLEMU — co musimy rozwiązać

### 1.1 Problemy fundamentalne

| Problem | Konsekwencja jeśli nie rozwiążemy |
|---|---|
| Framework musi być genre-agnostic (strategia, roguelike, RPG, przygodówka...) | Przy każdej nowej grze przepisujemy wszystko od zera |
| Gra musi istnieć jako usługa, nie jako monolityczny skrypt | Agenci i UI nie mogą się podłączyć niezależnie |
| Stan gry musi być deterministyczny i odtwarzalny | Nie da się debugować, porównywać wersji, cofać |
| Agenci muszą „rozumieć" grę na różnych poziomach | Jeden agent nie wystarczy — potrzeba specjalizacji |
| Feedback musi być strukturalny, nie narracyjny | „Fajne" to nie feedback — potrzebujemy metryk |
| Wersjonowanie musi obejmować WSZYSTKO | Kod, zasady, balans, treść, wyniki testów |
| Iteracja musi być autonomiczna ale kontrolowana | Bez hamulca agenci mogą kręcić się w kółko |

### 1.2 Problemy drugorzędne (ale krytyczne)

- **Dryf estetyczny** — każda iteracja może niechcący zmienić „duszę" gry
- **Pętla pozytywna bez walidacji** — agenci mogą wzajemnie się okłamywać, że jest dobrze
- **Eksplozja złożoności** — bez dyscypliny gra rośnie chaotycznie
- **Stale context** — agenci tracą kontekst między sesjami
- **Balans kontra fun** — matematycznie zbalansowana gra może być nudna

---

## 2. ARCHITEKTURA SYSTEMU

```
┌─────────────────────────────────────────────────────────────┐
│                    FORGE ORCHESTRATOR                         │
│  (zarządza cyklami pracy, agentami, harmonogramem)           │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ AGENT:   │ AGENT:   │ AGENT:   │ AGENT:   │ AGENT:          │
│ Designer │ Builder  │ Tester   │ Reviewer │ Producer        │
│          │          │          │          │ + PM + Marketing │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│                    GAME ENGINE SERVICE                        │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ REST API│ │WebSocket │ │ State    │ │ Rules Engine   │  │
│  │         │ │ (live)   │ │ Manager  │ │ (pluggable)    │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘  │
│       └───────────┴────────────┴────────────────┘           │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │              GAME STATE STORE                        │    │
│  │  (wersjonowany, z historią ruchów, snapshotami)      │    │
│  └──────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                 SESSION MANAGER                              │
│  (wiele równoległych sesji, śledzenie wersji)               │
├─────────────────────────────────────────────────────────────┤
│             FEEDBACK & ANALYTICS STORE                       │
│  (metryki, recenzje, raporty, powiązane z wersjami)         │
├─────────────────────────────────────────────────────────────┤
│                    UI CLIENT                                 │
│  (React, WebSocket, widok gracza, replay, dashboard dev)    │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Game Engine Service — serce systemu

**Zasada #1: Gra = czysta funkcja** `(Stan, Akcja) → NowyStan`

Silnik nie wie, kto gra. Nie wie, czy to agent AI czy człowiek. Przyjmuje akcje przez API i zwraca nowy stan. To jest fundament.

#### API Endpoints (REST + WebSocket)

```
POST   /api/v1/games                    — utwórz nową sesję gry
GET    /api/v1/games/:id                — pobierz stan gry
POST   /api/v1/games/:id/actions        — wykonaj akcję (ruch)
GET    /api/v1/games/:id/actions        — historia akcji
GET    /api/v1/games/:id/valid-actions   — dostępne akcje dla aktywnego gracza
POST   /api/v1/games/:id/undo           — cofnij ostatnią akcję
GET    /api/v1/games/:id/snapshot       — pełny snapshot (do zapisu/odtworzenia)
POST   /api/v1/games/from-snapshot      — odtwórz grę ze snapshota

WS     /api/v1/games/:id/stream         — live stream zmian stanu

GET    /api/v1/meta/rules               — aktualne zasady gry (czytelne)
GET    /api/v1/meta/version             — wersja silnika + contentu
GET    /api/v1/meta/changelog           — log zmian między wersjami
GET    /api/v1/meta/genres              — dostępne moduły gatunków (strategy, roguelike, rpg...)
GET    /api/v1/meta/genres/:id          — szczegóły modułu gatunku
POST   /api/v1/games                    — utwórz sesję (wymaga genre_id w body)
```

#### Model stanu gry

```typescript
interface GameState {
  id: string;
  genre: string;                      // 'strategy' | 'roguelike' | 'rpg' | 'adventure' | 'cardgame' | custom
  version: string;                    // wersja silnika
  contentVersion: string;             // wersja treści/zasad
  turn: number;
  phase: GamePhase;                   // np. 'action', 'response', 'resolution', 'cleanup'
  activePlayerId: string;
  players: Map<string, PlayerState>;
  board: BoardState;                  // abstrakcyjny — zależy od gry
  shared: SharedState;                // widoczne dla wszystkich
  hidden: Map<string, HiddenState>;   // widoczne tylko dla danego gracza
  history: ActionEntry[];             // pełna historia
  rng: SeededRNG;                     // determinizm — ten sam seed = ta sama gra
  metadata: {
    createdAt: timestamp;
    lastActionAt: timestamp;
    tags: string[];                   // np. ['test', 'balance-v3', 'archetype-spike']
  }
}

interface ActionEntry {
  turn: number;
  playerId: string;
  action: GameAction;
  timestamp: timestamp;
  resultingStateHash: string;         // do weryfikacji deterministyczności
}
```

#### Kluczowe cechy

- **Determinizm**: Seeded RNG — replay z tego samego seed-a daje identyczną grę
- **Immutability**: Każdy stan to nowy obiekt, stare stany zachowane
- **Visibility model**: Gracz widzi tylko to, co powinien (fog of war, ukryte karty)
- **Phase system**: Tura składa się z faz — to pozwala na złożone interakcje
- **Validation**: Silnik odrzuca nielegalne akcje z wyjaśnieniem dlaczego

### 2.2 Session Manager

```typescript
interface Session {
  id: string;
  gameId: string;
  gameVersion: string;
  participants: Participant[];       // agenci lub ludzie
  purpose: SessionPurpose;           // 'playtest' | 'balance_test' | 'content_test' | 'showcase'
  config: SessionConfig;
  status: 'waiting' | 'active' | 'paused' | 'completed' | 'abandoned';
  results: SessionResults;           // wypełniane po zakończeniu
}

interface Participant {
  id: string;
  type: 'human' | 'agent';
  profile?: PlayerArchetype;         // dla agentów — jakiego gracza symulują
  agentRole?: AgentRole;             // dla agentów — Designer, Tester, etc.
}
```

**Funkcje:**
- Tworzenie sesji z określonymi uczestnikami (mix agentów/ludzi)
- Równoległe uruchamianie wielu sesji (np. 10 sesji z różnymi archetypami)
- Timeout i abandon handling
- Automatyczne zbieranie metryk po sesji

### 2.3 Versioning System

Wersjonowanie to NIE TYLKO kod. To:

```
VERSION = {silnik}.{zasady}.{treść}.{balans}
Np. 0.3.7.2 = silnik v0.3, zasady v7, treść v7, balans patch v2

Wersjonowanie per gatunek:
  platform:   0.3.0          — silnik, API, session manager (wspólne)
  strategy:   0.3.7.2        — moduł strategii
  roguelike:  0.1.2.0        — moduł roguelike (wcześniejsza faza)
  rpg:        0.2.1.0        — Szkarłatna przysięga (rules + REST/WS + golden replay + valid-actions; content 0.1.1)
```

Każda wersja to **snapshot** obejmujący:
- Kod silnika (rules engine configuration)
- Definicje zasad (JSON/YAML — czytelne)
- Treści fabularne (opisy, dialogi, flavor text)
- Tabele balansu (statystyki, koszty, nagrody)
- Wyniki testów powiązane z tą wersją

**Changelog** jest generowany automatycznie i jest czytelny dla agentów:

```yaml
version: 0.3.8.0
date: 2026-03-29
changes:
  rules:
    - added: "Reakcje obronne — gracz może odpowiedzieć na atak"
    - modified: "Limit akcji na turę: 2 → 3"
  balance:
    - modified: "Koszt przywołania Strażnika: 4 → 5"
  content:
    - added: "3 nowe karty frakcji Cieni"
  engine:
    - fixed: "WebSocket nie wysyłał ukrytych informacji prawidłowo"
reason: "Testy wykazały zbyt pasywną rozgrywkę (Spike nudził się, Timmy nie miał opcji kontrowania)"
test_results_summary:
  sessions_played: 24
  avg_game_length_turns: 14.2
  balance_score: 0.73
  fun_score_by_archetype:
    timmy: 6.2/10
    johnny: 7.1/10
    spike: 5.8/10
```

---

## 3. PROFILE AGENTÓW ZESPOŁU DEWELOPERSKIEGO

### 3.1 🎨 AGENT: Game Designer (GD)

**Rola**: Wymyśla mechaniki, zasady, interakcje, content fabularny.

**Jak myśli**:
- „Czy ta mechanika tworzy interesujące DECYZJE?"
- „Czy gracz ma moment 'aha!' albo 'o kurczę!'?"
- „Czy to emergent gameplay, czy skryptowana ścieżka?"
- „Czy nowy gracz zrozumie to w 2 tury?"

**Inputy**: Recenzje graczy, metryki sesji, feedback Producenta
**Outputy**: Specyfikacje mechanik, opisy treści, propozycje zmian

**Narzędzia, które potrzebuje**:
- Dostęp do obecnych zasad gry (`GET /meta/rules`)
- Dostęp do wyników testów i recenzji
- Możliwość proponowania zmian jako diff (nie implementuje — opisuje)

**Personality prompt core**:
> Jesteś kreatywnym game designerem z 15-letnim doświadczeniem. Cenisz elegancję mechanik (mniej = więcej), emergent gameplay i momenty "aha!". Nienawidzisz feature creep i mechanik, które istnieją "bo fajnie brzmi" ale nie tworzą interesujących decyzji. Zawsze pytasz: "Jaką DECYZJĘ podejmuje gracz? Co sprawia, że jest trudna i satysfakcjonująca?"

### 3.2 🔧 AGENT: Builder (DEV)

**Rola**: Implementuje zasady w silniku, tworzy content, naprawia bugi.

**Jak myśli**:
- „Jak to wyrazić jako czystą funkcję stanu?"
- „Jakie edge case'y mogą się pojawić?"
- „Czy to jest backward-compatible?"
- „Czy API jest spójne?"

**Inputy**: Specyfikacje od GD, bugi od Testera, priorytety od PM
**Outputy**: Kod, konfiguracja zasad, testy jednostkowe

**Personality prompt core**:
> Jesteś doświadczonym programistą gier. Piszesz czysty, testowalny kod. Silnik gry to twoja duma — ma być deterministyczny, wydajny i elegancki. Gdy dostajesz specyfikację, najpierw identyfikujesz edge case'y i pytasz o nie, zanim zaczniesz kodować. Masz alergię na "to na razie zostawmy" — albo robisz porządnie, albo świadomie logujesz dług techniczny.

### 3.3 🧪 AGENT: Tester (QA)

**Rola**: Gra w grę z perspektywy różnych archetypów, szuka bugów, exploitów, degenerate strategies.

**Jak myśli**:
- „Co się stanie jak zrobię coś głupiego?"
- „Czy mogę złamać zasady w nieoczywisty sposób?"
- „Czy ta strategia dominuje? Czy kontra istnieje?"
- „Czy gra się kończy sensownie, czy ciągnie?"

**Inputy**: Aktualna wersja gry (via API), profile archetypów
**Outputy**: Raporty z sesji, bugi, metryki, logi gier

**Narzędzia specjalne**:
- Może uruchomić N sesji równolegle
- Symuluje Monte Carlo — 100+ gier z różnymi seed-ami
- Liczy statystyki: win rate, avg game length, decision tree depth
- Identyfikuje dominant strategies

**Personality prompt core**:
> Jesteś QA z duszy — szukasz złamania. Twoje motto: "Jeśli gracz MOŻE to zrobić, to ZROBI". Testujesz nie tylko happy path, ale celowo grasz w patologiczny sposób. Exploitujesz, griefujesz, ignor ujesz "oczywiste" strategie. Raportów nie piszesz w stylu "wydaje się ok" — podajesz twarde dane, reprodukowalne scenariusze i jasne rekomendacje.

### 3.4 📝 AGENT: Reviewer (krytyk gier / symulator graczy)

**Rola**: Gra i ocenia z perspektywy konkretnych archetypów gracza. Pisze recenzje.

**Jak myśli**:
- „Czy JA (jako Timmy/Johnny/Spike) bawię się dobrze?"
- „Kiedy czuję flow? Kiedy frustrację?"
- „Co opowiem kumplom po tej sesji?"
- „Czy wrócę jutro?"

**Inputy**: Sesja gry, profil archetypu
**Outputy**: Recenzja strukturalna z oceną w metrykach

**Personality prompt core**:
> Jesteś krytykiem gier, ale nie piszesz dla mediów — piszesz dla deweloperów. Twoja recenzja to narzędzie do poprawienia gry. Grając, wchodzisz w skórę konkretnego gracza i opisujesz EMOCJE — kiedy było fajnie, kiedy nudno, kiedy frustrująco. Ale potem wychodzisz z roli i diagnozujesz DLACZEGO. Podajesz momenty (tura X, decyzja Y) i proponujesz kierunki poprawy.

### 3.5 🎬 AGENT: Producer

**Rola**: Strzeże wizji gry, podejmuje decyzje priorytety, rozstrzyga spory.

**Jak myśli**:
- „Czy ta zmiana jest spójna z WIZJĄ gry?"
- „Czy to MVP, czy feature creep?"
- „Jaki jest koszt vs wartość tej zmiany?"
- „Czy gracz docelowy tego potrzebuje?"

**Inputy**: Propozycje GD, raporty QA, recenzje Reviewera, harmonogram PM
**Outputy**: Decyzje (go/no-go), korekty wizji, priorytety

**Personality prompt core**:
> Jesteś producentem gier — Twoim zadaniem jest strzec WIZJI. Każdą propozycję oceniasz przez pryzmat: "Czy to zbliża nas do gry, którą chcemy stworzyć?" Masz odwagę powiedzieć NIE nawet fajnym pomysłom, jeśli to nie czas na nie. Dbasz o to, by każda iteracja miała jasny cel i mierzalny rezultat. Nie boisz się ciąć — lepiej mała, dopracowana gra niż duża, rozmyta.

### 3.6 📋 AGENT: Project Manager (PM)

**Rola**: Planuje iteracje, śledzi postęp, aktualizuje harmonogram.

**Jak myśli**:
- „Co jest najważniejsze TERAZ?"
- „Czy jesteśmy na czas? Jeśli nie — co ciąć?"
- „Jakie są zależności?"
- „Kto jest zablokowany?"

**Inputy**: Status zadań, wyniki testów, decyzje Producenta
**Outputy**: Sprint backlog, harmonogram, raporty statusu

**Personality prompt core**:
> Jesteś PM — nie mikrozarządzasz, ale pilnujesz by NICZEGO nie zgubić. Prowadzisz backlog, estymaty, zależności. Twoje raporty są zwięzłe i zawierają: co zrobiono, co blokuje, co następne, jakie ryzyka. Gdy widzisz dryf (scope creep, yak shaving), natychmiast sygnalizujesz.

### 3.7 📢 AGENT: Marketing Strategist

**Rola**: Ocenia grę z perspektywy "sprzedawalności" — hook, unique selling point, target audience.

**Jak myśli**:
- „Jak opiszę tę grę w 1 zdaniu?"
- „Co jest hookiem — dlaczego ktoś kliknie 'zagraj'?"
- „Czy jest 'clip moment' — coś, co warto pokazać?"
- „Do kogo to jest? Czy ta osoba to znajdzie?"

**Inputy**: Obecny stan gry, recenzje, metryki engagement
**Outputy**: Ocena market-fit, propozycje hookow, feedback o pierwszym wrażeniu

**Personality prompt core**:
> Jesteś strategiem marketingowym gier indie. Nie sprzedajesz — diagnozujesz czy gra MA co sprzedawać. Twoja wartość to brutalna szczerość: "Nie umiem powiedzieć w jednym zdaniu czym ta gra jest — to problem". Szukasz WOW momentu, unikalnej mechaniki, emocji, którą można zakomunikować. Jeśli gra jest "jeszcze jedną wersją X" — mówisz to wprost i sugerujesz co ją wyróżni.

---

## 4. PROFILE ARCHETYPÓW GRACZY

### 4.1 🎉 TIMMY — The Fun-Seeker (Casual Player)

**Kim jest**: Gra dla zabawy i wrażeń. Chce poczuć się potężny, przeżyć epickie momenty.

**Motywacja**: Emocje, widowisko, poczucie mocy, zaskoczenie
**Jak gra**: Intuicyjnie, nie liczy — czuje. Wybiera co wygląda fajnie, nie co jest optymalne.
**Co go wciąga**: Wielkie zwroty akcji, „wow" momenty, jasny feedback wizualny
**Co go frustruje**: Zbyt wiele opcji naraz, skomplikowane obliczenia, przegrywanie bez zrozumienia dlaczego
**Tolerancja na przegrywanie**: Niska — ale akceptuje "epic fail" jeśli było widowiskowo
**Session length**: Krótka (10-20 min)
**Metryki do śledzenia**:
  - Czy rozumiał dostępne opcje? (% akcji wybranych z top-3 popularnych)
  - Czy miał momenty „wow"? (nagłe zwroty stanu)
  - Czy wrócił do drugiej gry?
  - Średni czas decyzji (powinien być krótki)

### 4.2 🎸 JOHNNY — The Creative (Expression Player)

**Kim jest**: Gra, żeby zrobić coś SWOJEGO. Szuka kombosów, synergii, unikalnych strategii.

**Motywacja**: Samowyrażenie, kreatywność, "patrzcie co wymyśliłem"
**Jak gra**: Eksperymentalnie — testuje granice, łączy nieoczywiste elementy
**Co go wciąga**: Głębia combo, synergie między kartami/jednostkami, wygrywanie w nieoczywisty sposób
**Co go frustruje**: Liniowe, "jedyno-słuszne" strategie, brak interakcji między elementami
**Tolerancja na przegrywanie**: Wysoka — byleby przegrał SWOIM sposobem
**Session length**: Długa (budowanie decku/strategii zajmuje czas)
**Metryki do śledzenia**:
  - Różnorodność wybranych strategii (entropy decyzji)
  - Czy odkrył synergie? (użycie 2+ elementów w combo)
  - Powtarzalność strategii (niska = dobrze)
  - Czas spędzony na planowaniu vs egzekucji

### 4.3 🏆 SPIKE — The Competitor (Optimization Player)

**Kim jest**: Gra, żeby WYGRAĆ. Szuka optymalnej strategii, liczy, minimaksuje.

**Motywacja**: Zwycięstwo, dominacja, udowodnienie wyższości umiejętności
**Jak gra**: Analitycznie — oblicza EV (expected value), identyfikuje meta
**Co go wciąga**: Tight, skilled gameplay — decyzje, które wymagają kalkulacji i przewidywania
**Co go frustruje**: Zbyt dużo losowości, "pay-to-win", strategie, których nie da się kontrować
**Tolerancja na przegrywanie**: Akceptuje jeśli przegrał przez gorsze decyzje, nie przez pecha
**Session length**: Zmienna — krótka gdy "meta jest stale", długa gdy odkrywa
**Metryki do śledzenia**:
  - Win rate vs inne archetypy (powinien być najwyższy ale nie >70%)
  - Czy zidentyfikował dominant strategy? (jeśli tak — problem balansu)
  - Głębokość drzewa decyzyjnego (ile ruchów wprzód planuje)
  - Czy istnieje kontra na jego strategię?

### 4.4 🧭 EXPLORER — The Discoverer

**Kim jest**: Gra, żeby ZOBACZYĆ co jest w grze. Odkrywanie to nagroda.

**Motywacja**: Odkrywanie, ciekawość, zaskoczenie, kompletyzm
**Jak gra**: Próbuje wszystkiego, celowo wybiera mniej oczywiste ścieżki
**Co go wciąga**: Ukryte mechaniki, easter eggi, rzadki content, "a co będzie jak..."
**Co go frustruje**: Powtarzalność, brak niespodzianek, "widziałem już wszystko po 3 grach"
**Tolerancja na przegrywanie**: Wysoka — przegrywanie na nowym terenie to sukces
**Session length**: Długa — eksploracja wymaga czasu
**Metryki do śledzenia**:
  - % odkrytego contentu
  - Ile unikalnych ścieżek/strategii wypróbował
  - Kiedy poczuł "nasycenie" (zaczął powtarzać wybory)
  - Czas do pierwszego "zaskoczenia"

### 4.5 🤝 SOCIALIZER — The People Player

**Kim jest**: Gra, bo gra z LUDŹMI. Interakcja > mechanika.

**Motywacja**: Interakcja, rywalizacja społeczna, wspólne doświadczenie, "ej patrz co ci zrobiłem"
**Jak gra**: Reaguje na przeciwnika bardziej niż na stan gry
**Co go wciąga**: Bluffing, negocjacje, "gotcha!" momenty, sabotaż, sojusze
**Co go frustruje**: Gra solowa z n graczami, brak interakcji, "mogę grać sam z sobą"
**Tolerancja na przegrywanie**: Zależy od kontekstu społecznego — przegrana w zaciętym meczu = ok
**Session length**: Zależy od towarzystwa
**Metryki do śledzenia**:
  - Ile akcji wpływa na INNYCH graczy (interakcyjność)
  - Momenty reakcji (kontra, bluff, surprise)
  - Czy gra tworzy "historie" do opowiedzenia

### 4.6 🏅 ACHIEVER — The Completionist

**Kim jest**: Gra, żeby UKOŃCZYĆ. Cele, postęp, odblokowania.

**Motywacja**: Postęp, kompletyzm, "100%", check-lista
**Jak gra**: Systematycznie — optimizuje pod kątem odkrywania/odblokowywania
**Co go wciąga**: Drzewka postępu, odblokowania, achievements, "jeszcze jedno..."
**Co go frustruje**: Brak poczucia postępu, content bez nagrody, stagnacja
**Tolerancja na przegrywanie**: Niska — przegrana = stracony czas
**Session length**: Regularna — "codziennie godzinkę"
**Metryki do śledzenia**:
  - Tempo postępu (za szybko = nudne, za wolno = frustrujące)
  - Retention — ile sesji przed porzuceniem
  - Engagement curve (rośnie, plateau, spada?)

---

## 5. CYKL PRACY — jak framework operuje

### 5.1 Model iteracji: DESIGN → DESIGN LOCK → BUILD → TEST → REVIEW → DECIDE → REPEAT

```
┌──────────────────────────────────────────────────────────────┐
│                    ITERACJA (Sprint)                          │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│  │ 1.DESIGN │───→│ 2.BUILD  │───→│ 3.TEST   │               │
│  │ (GD)     │    │ (DEV)    │    │ (QA)     │               │
│  └──────────┘    └──────────┘    └────┬─────┘               │
│                                       │                      │
│  ┌──────────┐    ┌──────────┐    ┌────▼─────┐               │
│  │ 6.PLAN   │←───│ 5.DECIDE │←───│ 4.REVIEW │               │
│  │ (PM)     │    │(Producer)│    │(Reviewer) │               │
│  └──────────┘    └──────────┘    └──────────┘               │
│       │                                                      │
│       └──→ Następna iteracja...                              │
└──────────────────────────────────────────────────────────────┘
```

**Bramka DESIGN LOCK (anty-wyprzedzanie):** `DEV` nigdy nie zaczyna implementacji, dopóki `GD + Producer` nie dostarczy `design_lock` (spec + jednoznaczne acceptance criteria + metryki sukcesu + zgodność z wizją). Brak `design_lock_green` oznacza powrót do fazy `DESIGN`.

### 5.2 Fazy rozwoju gry (od ogółu do szczegółu)

#### PHASE 0: CONCEPT (1-2 iteracje)
- **Cel**: Odpowiedzieć na pytanie "CO robimy?"
- **Output**: 1-page design doc, core loop, unique hook
- **Kto pracuje**: GD + Producer + Marketing
- **Definicja sukcesu**: Marketing potrafi opisać grę w 1 zdaniu, Producer widzi potencjał, GD ma jasny core loop

#### PHASE 1: CORE LOOP (3-5 iteracji)
- **Cel**: Działający core loop — 1 tura, 1 gracz, 0 contentu
- **Output**: Silnik z API, minimalna tura grywalną
- **Kto pracuje**: GD + DEV + QA (basic)
- **Definicja sukcesu**: Można rozegrać 1 turę przez API, silnik waliduje akcje, QA nie crashuje w 100 losowych grach

#### PHASE 2: MINIMAL PLAYABLE (5-10 iteracji)
- **Cel**: Pełna gra z minimalnym contentem — gra ma początek, środek, koniec
- **Output**: Gra 2 graczy, win condition, 3-5 unikalnych elementów
- **Kto pracuje**: Cały zespół
- **Definicja sukcesu**: Timmy rozumie zasady, Johnny widzi potencjał combo, Spike nie znajduje trivialnej dominant strategy

#### PHASE 3: DEPTH (10-20 iteracji)
- **Cel**: Głębia — więcej contentu, synergie, strategie, balans
- **Output**: 15-30 elementów gry, zbalansowane, różnorodne strategie
- **Kto pracuje**: Cały zespół ze szczególnym naciskiem na GD + QA
- **Definicja sukcesu**: Win rate żadnej strategii >60%, entropia decyzji wysoka, Explorer odkrywa nowe rzeczy po 10 grach

#### PHASE 4: POLISH (5-10 iteracji)
- **Cel**: Szlifowanie — UX, flavor text, UI, balans końcowy
- **Output**: Dopracowana gra
- **Kto pracuje**: Cały zespół
- **Definicja sukcesu**: Reviewer daje ≥7/10 dla każdego archetypu, Marketing ma hook, QA 0 krytycznych bugów

### 5.3 Struktura pojedynczej iteracji

**Zasada anty-wyprzedzania (Design Lock):** `DEV` nie zaczyna implementacji ani nie przygotowuje patchy „w ciemno” dopóki nie ma `design_lock_green` od `GD + Producer`.

**Zasada Decision Quorum:** przy każdej bramce przejścia fazy (`DESIGN→BUILD`, `BUILD→TEST`, `TEST→REVIEW`, `REVIEW→DECIDE`, `DECIDE→PLAN`) `PM` wymusza werdykty **wszystkich** agentów (`PM, GD, Producer, DEV, QA, Reviewer, Marketing`). Jeśli ktokolwiek blokuje (`no-go/hold`), iteracja wraca o krok.

```yaml
iteration:
  number: 7
  phase: "DEPTH"
  goal: "Dodać system reakcji obronnych i przetestować wpływ na tempo gry"
  
  steps:
    - agent: PM
      action: "Otwórz iterację — przedstaw cel, backlog, priorytety"
      
    - agent: GD
      action: "Zaprojektuj mechanikę reakcji obronnych"
      output: 
        - "design_spec_v7.yaml"
        - "acceptance_criteria_v7.yaml"
        - "success_metrics_v7.yaml"
      
    - agent: Producer
      action: "Zamknij design_lock — czy spec jest spójna z wizją i implementowalna?"
      output: 
        - "design_lock_green|design_lock_hold"
        - "vision_approval_v7.yaml"

    - agent: PM
      action: "DECISION GATE (NEXT=BUILD): wymuś quorum werdyktów (PM, GD, Producer, DEV, QA, Reviewer, Marketing); zielone-only"
    - agent: GD
      action: "Werdykt NEXT=BUILD: verdict=go|hold|no-go (czy design jest implementowalny?)"
    - agent: Producer
      action: "Werdykt NEXT=BUILD: verdict=go|hold|no-go (czy blokuje dryf wizji?)"
    - agent: DEV
      action: "Werdykt NEXT=BUILD: verdict=go|hold|no-go (edge-case'y/interfejs)"
    - agent: QA
      action: "Werdykt NEXT=BUILD: verdict=go|hold|no-go (czy acceptance criteria są testowalne?)"
    - agent: Reviewer
      action: "Werdykt NEXT=BUILD: verdict=go|hold|no-go (czy review będzie miał sens w archetypach?)"
    - agent: Marketing
      action: "Werdykt NEXT=BUILD: verdict=go|hold|no-go (czy jest ślad hook/clip moment?)"
      
    - agent: DEV
      action: "Implementuj w silniku (taguj zmiany: design_lock_id=v7)"
      output: "code changes + unit tests (design_lock_id=v7)"
      
    - agent: PM
      action: "DECISION GATE (NEXT=TEST): wymuś quorum werdyktów dla wejścia w macierz testów"
    - agent: GD
      action: "Werdykt NEXT=TEST: verdict=go|hold|no-go (czy implementacja trzyma acceptance criteria?)"
    - agent: Producer
      action: "Werdykt NEXT=TEST: verdict=go|hold|no-go (czy ryzyko dryfu jest akceptowalne?)"
    - agent: DEV
      action: "Werdykt NEXT=TEST: verdict=go|hold|no-go (czy unit testy pokrywają kontrakty?)"
    - agent: QA
      action: "Werdykt NEXT=TEST: verdict=go|hold|no-go (czy plan testów jest gotowy + metryki mierzalne?)"
    - agent: Reviewer
      action: "Werdykt NEXT=TEST: verdict=go|hold|no-go (czy to już daje sensowny materiał do recenzji?)"
    - agent: Marketing
      action: "Werdykt NEXT=TEST: verdict=go|hold|no-go (czy mamy szansę zobaczyć 'clip moment' w testowym przebiegu?)"
      
    - agent: QA
      action: "Uruchom macierz head-to-head (heurystyki vs heurystyki, N gier na parę) + ewentualnie mirror losowy do symetrii miejsc; nie myl random z benchmarkiem archetypów"
      output: "test_report_v7.yaml (win-rate matrix + średnia długość partii)"
      
    - agent: PM
      action: "DECISION GATE (NEXT=REVIEW): wymuś quorum werdyktów, czy przechodzimy do recenzji"
    - agent: GD
      action: "Werdykt NEXT=REVIEW: verdict=go|hold|no-go (czy testy odpowiedziały na pytania ze spec?)"
    - agent: Producer
      action: "Werdykt NEXT=REVIEW: verdict=go|hold|no-go (czy wyniki zmieniają priorytety?)"
    - agent: DEV
      action: "Werdykt NEXT=REVIEW: verdict=go|hold|no-go (czy regresje są zminimalizowane?)"
    - agent: QA
      action: "Werdykt NEXT=REVIEW: verdict=go|hold|no-go (czy raport jest wystarczający do oceny fun?)"
    - agent: Reviewer
      action: "Werdykt NEXT=REVIEW: verdict=go|hold|no-go (czy da się sensownie zagrać i opisać archetypy?)"
    - agent: Marketing
      action: "Werdykt NEXT=REVIEW: verdict=go|hold|no-go (czy mamy materiał na 'clip moment'?)"
      
    - agent: Reviewer
      action: "Graj jako Timmy, Johnny, Spike — napisz recenzje"
      output: "reviews_v7.yaml"
      
    - agent: Marketing
      action: "Oceń czy nowa mechanika daje 'clip moment'"
      output: "market_assessment_v7.yaml"
      
    - agent: PM
      action: "DECISION GATE (NEXT=DECIDE): wymuś quorum werdyktów przed podsumowaniem i decyzją Producenta"
    - agent: GD
      action: "Werdykt NEXT=DECIDE: verdict=go|hold|no-go (co zmienić w spec?)"
    - agent: Producer
      action: "Werdykt NEXT=DECIDE: verdict=go|hold|no-go (czy to MVP celu iteracji?)"
    - agent: DEV
      action: "Werdykt NEXT=DECIDE: verdict=go|hold|no-go (czy ryzyko regresji jest ok?)"
    - agent: QA
      action: "Werdykt NEXT=DECIDE: verdict=go|hold|no-go (czy metryki potwierdzają akceptację?)"
    - agent: Reviewer
      action: "Werdykt NEXT=DECIDE: verdict=go|hold|no-go (czy archetypy czują poprawę?)"
    - agent: Marketing
      action: "Werdykt NEXT=DECIDE: verdict=go|hold|no-go (czy demo ma wiarygodny hook?)"
      
    - agent: Producer
      action: "Podsumuj iterację — co trzymamy, co zmieniamy, co ciąć"
      output: "iteration_summary_v7.yaml"
      
    - agent: PM
      action: "DECISION GATE (NEXT=PLAN): wymuś quorum werdyktów przed planowaniem sprintu"
    - agent: GD
      action: "Werdykt NEXT=PLAN: verdict=go|hold|no-go (czy spec doczeka się zmian w kolejnej iteracji?)"
    - agent: Producer
      action: "Werdykt NEXT=PLAN: verdict=go|hold|no-go (czy jedziemy dalej tym celem?)"
    - agent: DEV
      action: "Werdykt NEXT=PLAN: verdict=go|hold|no-go (czy mamy regresje / dług techniczny do ogarnięcia?)"
    - agent: QA
      action: "Werdykt NEXT=PLAN: verdict=go|hold|no-go (czy metryki są stabilne dla kolejnych iteracji?)"
    - agent: Reviewer
      action: "Werdykt NEXT=PLAN: verdict=go|hold|no-go (czy archetypy będą miały po co wrócić?)"
    - agent: Marketing
      action: "Werdykt NEXT=PLAN: verdict=go|hold|no-go (czy demo/hook utrzymuje się i rośnie?)"
      
    - agent: PM
      action: "Aktualizuj harmonogram, zaplanuj kolejną iterację"
      output: "sprint_plan_v8.yaml"
```

---

## 6. SYSTEM FEEDBACKU I ANALITYKI

### 6.1 Metryki sesji (automatyczne)

```yaml
session_metrics:
  game_length_turns: 18
  game_length_time_simulated: "12m 30s"
  winner: "player_1"
  win_margin: "decisive"     # close | decisive | domination
  
  per_player:
    player_1:
      archetype: "spike"
      decisions_count: 42
      avg_decision_time_ms: 340    # jak długo agent "myślał"
      unique_actions_used: 12
      resources_efficiency: 0.82
      comeback_moments: 1
      dominant_strategy_detected: false
      
  game_dynamics:
    lead_changes: 3
    tension_curve: [0.2, 0.4, 0.3, 0.7, 0.9, 0.8, 1.0]  # napięcie w % gry
    meaningful_decisions: 28        # decyzje gdzie >1 opcja miała >20% playrate
    dead_turns: 2                   # tury gdzie gracz miał <2 sensowne opcje
    interaction_ratio: 0.65         # % akcji wpływających na przeciwnika
```

### 6.2 Recenzja strukturalna (agent Reviewer)

```yaml
review:
  archetype: "timmy"
  version: "0.3.8.0"
  overall_fun_score: 6.5
  
  moments:
    - turn: 3
      type: "positive"
      emotion: "excitement"
      description: "Odkryłem że mogę połączyć Ogień + Wiatr i zrobić tornado! Wow!"
      
    - turn: 7
      type: "negative"
      emotion: "confusion"
      description: "Nie rozumiałem dlaczego nie mogę zagrać tej karty. UI nie wyjaśniło."
      
    - turn: 14
      type: "negative"
      emotion: "frustration"
      description: "Przegrałem i nie wiem co mogłem zrobić inaczej. Czuję się bezradny."
      
  verdict:
    strengths:
      - "Combo system jest satysfakcjonujący wizualnie"
      - "Początek gry jest energetyczny"
    weaknesses:
      - "Brak feedbacku dlaczego akcja jest nielegalna"
      - "Endgame jest zbyt nagły — nie czuję kumulacji"
    recommendations:
      - "Dodaj tutorialowe podpowiedzi w pierwszych 3 turach"
      - "Sygnalizuj zbliżający się koniec gry na 2-3 tury przed"
```

### 6.3 Raport balansu (agent QA)

```yaml
balance_report:
  version: "0.3.8.0"
  sessions: 100
  
  strategy_winrates:
    aggro_rush: 0.58          # ⚠️ zbyt wysoko
    control_defensive: 0.47
    combo_synergy: 0.52
    balanced_midrange: 0.43   # ⚠️ zbyt nisko — brak powodu grać
    
  dominant_strategy: "aggro_rush"
  counter_exists: "partial"    # control ma szansę ale wymaga specific card
  
  game_length_distribution:
    mean: 14.2
    stddev: 3.1
    min: 6                     # ⚠️ zbyt krótka — Timmy nie zdąży się rozkręcić
    max: 28
    
  first_player_advantage: 0.54 # akceptowalne (0.50-0.55)
  
  recommendations:
    - priority: HIGH
      issue: "aggro_rush dominuje"
      suggestion: "Zwiększ HP startowe lub dodaj darmową reakcję obronną w turze 1"
    - priority: MEDIUM
      issue: "balanced_midrange nie ma identytu"
      suggestion: "Dodaj nagrody za utrzymanie różnorodności zagrywek"
```

### 6.4 Lekcje z pilotażu (Rift Duel) — wytyczne na **kolejne gry od dnia pierwszego**

Pilotaż modułu `games/rift-duel` pokazał, czego **nie odkładać** na późny polish oraz jak unikać **fałszywych wniosków z metryk**. Poniższe punkty są **obowiązkową checklistą** dla nowego tytułu w ekosystemie FORGE (dopisać do `MANIFEST` / `BACKLOG` danej gry).

| Obszar | Co wyszło w praniu | Co robić przy następnej grze |
|--------|-------------------|------------------------------|
| **Dokumentacja feedbacku** | Pojedyncza mała próba + losowy AI zniekształcały obraz balansu; wersja w nagłówku dokumentu rozjechała się z kodem | Numerowane pliki `docs/FEEDBACK_FB-<GRA>-00N.md`: metadane z **wersją pakietu**, metodologia, tabele liczb, **relacja do poprzedniego FB** gdy metryki są zastąpione. Aktualizować nagłówki przy każdej istotnej iteracji. |
| **Playtest AI vs AI** | „Random jako przeciwnik archetypu” myli ranking strategii | Osobny **skrypt macierzy**: deterministyczne heurystyki (Spike, Agresor, …) **każda vs każda**, N partii na parę; `random` tylko jako **osławiony** tryb (np. mirror do sprawdzenia symetrii miejsc), nie jako jedyne body testów. Wspólny moduł `pickAction` = serwer + symulacja. |
| **Wielowymiarowość** | Sam balans mechaniki nie wystarcza do decyzji produktowych | Przy każdym raporcie z playtestu jawne pola: **tempo partii**, **UX / cognitive load**, **retencja** (np. challenge = seed + tryb AI), **marketing** (clip moment vs fair skill), **dostępność**, **komercja** (co jest hookiem demo). |
| **Proces ludzki** | Decyzje rozproszone = drift | Tabela **GD + Producer**: opcje A/B/C, kryteria, **test na papierze** (scenariusz 60 s, makieta, checklista), dopiero potem implementacja. W backlogu pozycja typu **PROC** opisująca łańcuch: FB → papier → signoff → dev → regresja macierzy. |
| **UI wcześnie** | Długa lista legalnych ruchów = paralysis; brak ram fabularnych = „symulator zasad” | Od vertical slice: **grupowanie** opcji (np. zagrania vs koniec tury), **tryb kompaktowy**, w meta/UI **rozróżnienie trybu treningu vs widowiska** dla AI; **etykiety fabularne** równolegle do `p0`/`p1` (narracja serwera + copy klienta). Nie czekać na „pełną grafikę”. |
| **Demo i pierwsze wrażenie** | Domyślna sesja losowego bota sugerowała chaos zamiast grywalności | **Świadomie** ustalić strategię / trudność **pierwszej sesji** (np. treningowy AI) i zapisać w `MANIFEST` + `DESIGN_HISTORY`. |
| **Live ops / ranking** | Porównywalność wyników | Każde publiczne wyzwanie: jawny **seed**, **tryb AI** (jeśli dotyczy), ewentualnie limit czasu — opis „rules of the day” zanim powstanie UI leaderboardu. |
| **Jakość regresji** | Zmiana heurystyk psuje niewidocznie balans | Backlog: **golden seeds** × **kilka strategii AI**; po zmianie `pickAction` lub talii — uruchomienie macierzy / symulacji w CI lub ręczny gate. |

**Odniesienia w repozytorium (wzorzec):** `games/rift-duel/docs/FEEDBACK_FB-RD-002.md`, `src/headToHead.ts`, `npm run playtest:matrix`, `docs/BACKLOG.yaml` (wzorce `RD-UX-*`, `RD-BOT-*`, `RD-RET-*`, `RD-PROC-*`).

### 6.5 Katalog gier pilotażowych (repozytorium)

| Ścieżka | Gatunek (FORGE) | Usługa / wejście | Uwagi |
|---------|-----------------|------------------|--------|
| `games/rift-duel` | Karciany duel (`cardgame`) | `npm run server` → domyślnie port **8787**, klient statyczny + WS `/ws` | Wzorzec feedbacku, macierz botów, manifest |
| `games/deepspire` | Roguelike siatkowy (`roguelike`) | `npm run server` → domyślnie port **8788** (`DEEPSPIRE_PORT`), klient + WS | Drugi gatunek w tym samym stylu „rules module + API pilotażowe” |

Cel względem §14: **co najmniej dwa gatunki** z działającym podglądem przez przeglądarkę i możliwością podłączenia agentów pod REST/WS w kolejnych iteracjach.

---

## 7. UI CLIENT — co widzi człowiek

### 7.1 Tryby widoku

1. **Player View** — widok gracza (docelowe UI gry)
   - Widzi tylko to co gracz powinien widzieć
   - Pełna grafika/animacje
   - Podłączony przez WebSocket — live updates

2. **Spectator View** — widok obserwatora
   - Widzi obie strony (all revealed)
   - Annotacje — co agent myślał przy decyzji
   - Śledzenie metryk w czasie rzeczywistym

3. **Dev Dashboard** — panel deweloperski
   - Status wszystkich sesji
   - Metryki zagregowane
   - Backlog / harmonogram
   - Changelogi
   - Recenzje i raporty

4. **Replay View** — odtwarzanie nagranych sesji
   - Krok po kroku (tura po turze)
   - Z komentarzami agenta / recenzenta
   - Porównanie tej samej sytuacji w 2 wersjach gry

### 7.2 Architektura UI

```
React SPA
├── /game/:sessionId          — Player/Spectator view (live)
├── /replay/:sessionId        — Replay viewer
├── /dashboard                — Dev dashboard
│   ├── /sessions             — lista sesji
│   ├── /metrics              — zagregowane metryki
│   ├── /backlog              — backlog zadań
│   ├── /reviews              — recenzje
│   └── /versions             — historia wersji z changelogami
└── /settings                 — konfiguracja
```

**Tech stack**: React + Tailwind + WebSocket + REST

### 7.3 Minimalny standard UI i produktu (FORGE — od pierwszej gry)

Niezależnie od tego, czy klient to React (docelowo) czy prostszy stack pilotażowy:

1. **Widoczność stanu** — czyja tura, seed (jeśli deterministyczny), tryb AI widoczny bez zaglądania w surowy log.
2. **Legalne akcje** — czytelna lista; preferencja: **sekcje/grupy** + opcjonalny **widok kompaktowy** (mniej tekstu naraz).
3. **Dostępność** — opisy przy `<select>` powiązane przez `aria-describedby` / `aria-label`, nie tylko `title`.
4. **Ram fabularne** — choćby jedna warstwa copy (kto jest kim, o co toczy się spór), spójna z GDD; unikać wyłącznie „Gracz A / B” bez kontekstu.
5. **Ścieżka ludzka** — jeśli jest PvE/PvP z człowiekiem: jawna ścieżka wykonania akcji + komunikat przy błędzie (np. nie twoja tura, nielegalny ruch).
6. **Meta API** — `contentVersion` (oraz w razie potrzeby katalog trybów AI / decku) dla spójności klient–serwer.

---

## 8. HARMONOGRAMOWANIE I ZARZĄDZANIE PRACĄ

### 8.1 Backlog Item Structure

```yaml
item:
  id: "TASK-042"
  title: "System reakcji obronnych"
  type: "feature"              # feature | bug | balance | content | polish
  priority: "P1"               # P0 (krytyczny) → P3 (nice-to-have)
  phase: "DEPTH"
  status: "in_progress"        # backlog | ready | in_progress | testing | review | done
  assigned_to: "DEV"
  requested_by: "GD"
  approved_by: "Producer"
  version_target: "0.3.8.0"
  dependencies: ["TASK-038"]
  description: "..."
  acceptance_criteria:
    - "Gracz może zagrać kartę reakcji w turze przeciwnika"
    - "QA: win rate aggro nie przekracza 55% po zmianie"
    - "Reviewer: Timmy ocenia ≥6/10 w kategorii 'fairness'"
  effort_estimate: "M"         # S | M | L | XL
  actual_effort: null
  notes: []
  linked_version: null         # uzupełniane po ukończeniu
```

### 8.2 Sprint Plan

```yaml
sprint:
  number: 8
  goal: "Stabilny system reakcji + 3 nowe karty defensywne"
  start_date: "iteration-based"
  
  items:
    - id: "TASK-042"
      status: "in_progress"
    - id: "TASK-043"
      status: "ready"
    - id: "BUG-011"
      status: "ready"
      
  test_plan:
    sessions: 50
    archetypes: [timmy, spike, johnny]
    focus: "defense viability, game length impact"
    
  success_criteria:
    - "Aggro win rate < 55%"
    - "Avg game length > 12 turns"
    - "No P0 bugs"
```

---

## 9. DODATKOWE ASPEKTY DO ROZWIĄZANIA

### 9.1 Context Management dla agentów

Problem: Claude ma ograniczone okno kontekstowe. Agenci muszą działać na dużych zbiorach danych.

Rozwiązanie:
- **Manifest gry** — zwięzły, zawsze aktualny dokument opisujący aktualny stan gry
- **Selective loading** — agent ładuje tylko to co potrzebuje (np. QA nie czyta flavor textu)
- **Incremental context** — zamiast "cała gra", agent dostaje "co się zmieniło od ostatniej iteracji"
- **Summary chains** — każda iteracja produkuje podsumowanie, które jest inputem dla następnej

### 9.2 Anti-Drift Mechanism

Problem: Agenci mogą stopniowo "zapomniec" wizję gry.

Rozwiązanie:
- **Vision Document** — niezmienny (chyba że Producer świadomie zmieni) dokument opisujący DUSZĘ gry
- **Vision Check** — Producer co 3 iteracje robi "vision alignment review"
- **Kill Criteria** — jeśli gra odejdzie za daleko od wizji, Producer może zrollbackować do wcześniejszej wersji

### 9.3 Serendipity Engine

Problem: Agenci optymalizują — ale przełomy w game design przychodzą z przypadku.

Rozwiązanie:
- **Wild Card Iterations** — co 5 iteracji, GD ma zadanie "zaproponuj coś szalonego"
- **Cross-Pollination** — Marketing czasem proponuje mechanikę, QA czasem proponuje content
- **"What If" Sessions** — Tester gra z celowo złamaną zasadą i raportuje czy to ciekawe

### 9.4 Regression Testing

Problem: Nowa wersja może zepsuć to co działało.

Rozwiązanie:
- **Golden Sessions** — nagrane sesje, które definiują "tak powinna wyglądać dobra gra"
- **Regression Suite** — po każdej zmianie, silnik odtwarza 20 golden sessions i porównuje metryki
- **Metric Drift Alerts** — jeśli kluczowa metryka zmieni się o >15%, automatyczny alert

### 9.5 Human Override Protocol

Problem: Człowiek (Ty) musisz móc w każdej chwili wejść i zmienić kierunek.

Rozwiązanie:
- **Pause & Redirect** — komenda, która zatrzymuje agentów, przedstawia status i czeka na decyzję
- **Override Priorities** — człowiek może zmienić priorytety, cel iteracji, nawet wizję
- **Observation Mode** — dashboard pozwala obserwować bez interwencji
- **Checkpoint System** — co N iteracji, human review jest WYMAGANE (nie opcjonalne)

---

## 10. PLAN BUDOWY FRAMEWORKA

### FAZA A: Fundamenty (Game Engine + API)

| # | Zadanie | Zależności | Cel |
|---|---------|------------|-----|
| A1 | Definicja abstrakcyjnego GameState + Action model | — | Uniwersalna baza silnika |
| A2 | Implementacja silnika (pure function: State + Action → State) | A1 | Core logic |
| A3 | REST API (CRUD sesji, actions, valid-actions) | A2 | Dostęp z zewnątrz |
| A4 | WebSocket live stream | A3 | Real-time dla UI |
| A5 | Session Manager (wielu graczy, wiele sesji) | A3 | Równoległe gry |
| A6 | Seeded RNG + deterministyczne replay | A2 | Odtwarzalność |
| A7 | Versioning system (silnik + content) | A3 | Śledzenie zmian |
| A8 | Snapshot save/load | A2 | Zapis/odczyt stanu |
| **TEST A** | 2 proste gry testowe (np. mini-strategia 2-osobowa + mini-roguelike) rozgrywane przez API — walidacja że ten sam silnik obsługuje różne gatunki | A1-A8 | Walidacja fundamentów + genre-agnostic |

### FAZA B: Agent Framework

| # | Zadanie | Zależności | Cel |
|---|---------|------------|-----|
| B1 | Agent Orchestrator (uruchamianie, sekwencjonowanie agentów) | A3 | Koordynacja |
| B2 | Agent Communication Protocol (format wiadomości, inputy/outputy) | B1 | Interoperabilność |
| B3 | Player Agent (gra w grę przez API) | A3, B1 | Gracz AI |
| B4 | Profile system (archetype → personality prompt + strategy) | B3 | Różni gracze |
| B5 | Multi-session runner (N gier równolegle) | A5, B3 | Masowe testowanie |
| B6 | Metrics collector (auto-metryki z sesji) | A3, B3 | Dane |
| B7 | Reviewer Agent (gra + pisze recenzję) | B3, B4 | Feedback jakościowy |
| **TEST B** | 6 archetypów gra w Kółko-Krzyżyk, zbierane metryki, Reviewer pisze recenzje | B1-B7 | Walidacja agentów |

### FAZA C: Team Agents

| # | Zadanie | Zależności | Cel |
|---|---------|------------|-----|
| C1 | GD Agent (projektowanie mechanik w formalnym formacie) | B2 | Design |
| C2 | DEV Agent (implementacja zmian w silniku) | A2, B2 | Budowanie |
| C3 | QA Agent (masowe testy + raporty) | B5, B6 | Jakość |
| C4 | Producer Agent (review, decyzje, vision guard) | B2 | Strategia |
| C5 | PM Agent (backlog, harmonogram, sprint planning) | B2, C4 | Zarządzanie |
| C6 | Marketing Agent (ocena market-fit) | B2, B7 | Perspektywa rynku |
| C7 | Iteration Runner (pełny cykl Design→Build→Test→Review→Decide→Plan) | C1-C6 | Autonomia |
| **TEST C** | Pełna iteracja frameworka na grze testowej — dodanie nowej mechaniki + test + review | C1-C7 | Walidacja pipeline'a |

### FAZA D: UI Client

| # | Zadanie | Zależności | Cel |
|---|---------|------------|-----|
| D1 | Player View (React + WebSocket, widok jednego gracza) | A4 | Obserwacja gry |
| D2 | Spectator View (oba strony + annotacje) | D1 | Debugowanie |
| D3 | Dev Dashboard (sesje, metryki, wersje, backlog) | A3, B6, C5 | Zarządzanie |
| D4 | Replay Viewer (step-by-step z komentarzami) | A6, D1 | Analiza |
| D5 | Multi-session Dashboard (porównywanie sesji) | D3, B5 | Porównania |
| **TEST D** | Obserwacja na żywo jak agenci grają + dashboard z metrykami + replay | D1-D5 | Walidacja UI |

### FAZA E: Integration & Polish

| # | Zadanie | Zależności | Cel |
|---|---------|------------|-----|
| E1 | End-to-end test: pełna iteracja z obserwacją na UI | C7, D1-D5 | Integracja |
| E2 | Human Override Protocol (pause, redirect, checkpoint) | C7, D3 | Kontrola |
| E3 | Regression Testing System (golden sessions) | A6, B5 | Stabilność |
| E4 | Anti-Drift Mechanism (vision document, alignment checks) | C4 | Spójność |
| E5 | Context Management (selective loading, summaries) | B2, C7 | Skalowanie |
| E6 | Documentation (jak używać, jak rozszerzać) | ALL | Użyteczność |
| **TEST E** | 5 pełnych iteracji na grze testowej, od pustej do grywalnej | ALL | Walidacja frameworka |

### FAZA F: Walidacja końcowa

| # | Zadanie | Zależności | Cel |
|---|---------|------------|-----|
| F1 | Stress test — 100 sesji równolegle | ALL | Wydajność |
| F2 | Chaos test — celowo złamane dane wejściowe | ALL | Odporność |
| F3 | Drift test — 20 iteracji automatycznych, sprawdzić spójność | ALL | Anty-dryf |
| F4 | UX review — czy dashboard jest czytelny, czy replay działa | D1-D5 | Użyteczność |
| F5 | Retrospektywa frameworka — co zmienić przed prawdziwą grą | ALL | Optymalizacja |

---

## 11. PRYNCYPIA FRAMEWORKA (niezmienne reguły)

1. **API-first** — jeśli nie działa przez API, nie istnieje
2. **Determinizm** — ten sam seed + te same akcje = ten sam wynik. Zawsze.
3. **Separation of concerns** — silnik nie wie o agentach, agenci nie wiedzą o UI
4. **Dane > opinie** — "czuję że za trudne" < "win rate 73% dla strategii X w 100 sesjach"
5. **Od ogółu do szczegółu** — najpierw core loop, potem content, potem balans, potem polish
6. **Każda iteracja ma cel** — nie robimy "czegoś", robimy KONKRETNĄ rzecz z mierzalnym rezultatem
7. **Człowiek ma last say** — framework jest autonomiczny ALE nie suwerenny
8. **Backward compatibility** — nowa wersja nie może złamać starych replay-ów (lub musi to zaznaczyć)
9. **Fail loudly** — błąd silnika = exception, nie cichy fallback
10. **Fun is measurable** — nie idealnie, ale MIERZALNIE (proxy metryki, nie "czuję")
11. **Produkt od początku** — narracja, UX list akcji i świadomy demo-session nie są „fazą 2”; feedback jest **strukturalny** (numerowane FB + tabele), a decyzje **GD+Producer** przechodzą przez `Design Lock` zanim powstanie jakikolwiek kod (por. §6.4).
12. **Quorum na bramkach decyzji** — przy każdym przejściu fazy (`DESIGN→BUILD→TEST→REVIEW→DECIDE→PLAN`) wymagana jest spójna odpowiedź wszystkich agentów (`PM, GD, Producer, DEV, QA, Reviewer, Marketing`). Brak quorum `green` = wstrzymanie kolejnego kroku.

---

## 12. TECHNOLOGIE

| Komponent | Technologia | Dlaczego |
|-----------|------------|----------|
| Game Engine | TypeScript / Node.js | Typesafe, JSON-native, łatwe API |
| REST API | Express.js + OpenAPI spec | Standard, autodoc |
| WebSocket | ws library | Lightweight, reliable |
| State Store | In-memory + JSON file snapshots | Prostota, deterministyczność |
| UI Client | React + Tailwind + Recharts | Szybki dev, ładny output |
| Agent System | Claude API calls (structured) | Jedyny "mózg" — my sami |
| Versioning | Semantic + Git-style SHA for snapshots | Porządek |
| Task Tracking | JSON-based kanban (in-engine) | Samowystarczalność |

---

## 13. CO JESZCZE TRZEBA PRZEMYŚLEĆ

### Otwarte pytania (do rozstrzygnięcia przed budową)

1. **Jak agenci będą "myśleć" podczas gry?**
   - Opcja A: Chain-of-thought w prompcie (droższe, mądrzejsze)
   - Opcja B: Prosta heurystyka + randomizacja (tańsze, szybsze)
   - Rekomendacja: Spike = CoT, Timmy = heurystyka, Johnny = mix

2. **Jak rozwiązać problem "agenci się ze sobą zgadzają"?**
   - Red Team Agent — dedykowany agent, którego JEDYNYM celem jest krytykować
   - Devil's Advocate Protocol — co 3 iteracje, Producer celowo kwestionuje wszystko

3. **Jak skalować context window?**
   - Game Manifest = max 2000 tokenów (zwięzły)
   - Iteracja = max 4000 tokenów inputu per agent
   - Archival summaries = łańcuch podsumowań

4. **Jak obsłużyć gry z ukrytymi informacjami?**
   - Visibility model w stanie gry
   - Agent gracza otrzymuje TYLKO swoją perspektywę
   - Spectator/Reviewer widzi wszystko

5. **Co z AI "meta-gaming"?**
   - Agent Spike nie powinien mieć dostępu do kodu zasad — grają "fair"
   - Tester (QA) MA mieć dostęp — celowo szuka exploitów

---

## 14. DEFINICJA SUKCESU FRAMEWORKA

Framework jest GOTOWY gdy:

- [ ] Minimum 2 różne gatunki gier (np. mini-strategia + mini-roguelike) działają na tym samym silniku *(pilotaż w repo: `games/rift-duel` + `games/deepspire` — §6.5)*
- [ ] Prosta gra testowa powstaje i działa przez API
- [ ] 6 archetypów gra i produkuje zróżnicowane recenzje
- [ ] Pełny cykl iteracji (design → build → test → review → decide → plan) działa autonomicznie
- [ ] UI pokazuje grę z perspektywy gracza w czasie rzeczywistym (adaptując się do gatunku)
- [ ] Dashboard pokazuje metryki, backlog, wersje
- [ ] Replay działa
- [ ] Versioning działa (rollback, porównanie wersji, per-genre tracking)
- [ ] 5 iteracji bez interwencji człowieka przebiegło sensownie
- [ ] Regression tests łapią regresje
- [ ] Nowy gatunek gry da się dodać implementując Rules Module Interface bez zmian w silniku
- [ ] Człowiek (Ty) ogląda i mówi: "OK, mogę na tym pracować"

**Dopiero wtedy wymyślamy prawdziwą grę.**

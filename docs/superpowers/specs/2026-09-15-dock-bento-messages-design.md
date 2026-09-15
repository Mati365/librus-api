# Dock navigation, side-by-side bento views, and messages

Data: 2026-09-15
Branch: `dock-bento-messages`
Poprzedni spec: `2026-09-14-dockerized-multi-account-timetable-design.md`

## Cel

Aplikacja pokazuje dziś plan lekcji jednego konta na raz (nawigacja zakładkami
shadcn `Tabs`). Ten spec zmienia to na widok „wszystkie dzieci naraz": siatka
bento z kafelkiem na każde konto, nawigacja dockiem (MagicUI), oraz nowy drugi
widok — wiadomości z Librusa, w tej samej siatce.

## Zakres

- Nawigacja: MagicUI `Dock` (dolny, wyśrodkowany, z magnifikacją) z trzema
  ikonami przełączającymi widok: dodaj konto / plan lekcji / wiadomości.
- Widok planu lekcji: siatka kafelków (jeden na konto) z lekcjami **na dziś**;
  kliknięcie kafelka otwiera dialog z pełnym tygodniem (istniejący
  `TimetableView` z nawigacją tygodniami).
- Widok wiadomości: siatka kafelków (jeden na konto) z listą odebranych
  wiadomości; kliknięcie wiadomości otwiera dialog z jej treścią.
- Backend: dwa nowe endpointy na wiadomości.
- Poza zakresem: wysyłanie wiadomości, załączniki, ogłoszenia, oceny,
  frekwencja, usuwanie wiadomości.

## Nawigacja (Dock)

MagicUI `Dock` przypięty na dole ekranu, wyśrodkowany, trzy `DockIcon`
(ikony z `lucide-react`, każda z tooltipem shadcn):

| Ikona | Widok | Zawartość |
|---|---|---|
| `UserPlus` | `add` | istniejący `AddAccountForm`, bez siatki |
| `CalendarDays` | `calendar` (domyślny) | siatka planów lekcji |
| `Mail` | `messages` | siatka wiadomości |

Aktywny widok trzymany jest w stanie `App.tsx` (`"calendar" | "messages" |
"add"`), bez routingu. Przy zerowej liczbie kont widok `calendar` i `messages`
pokazują pustą informację zachęcającą do dodania konta, a dock pozostaje
widoczny.

`Tabs` (`src/components/ui/tabs.tsx`) zostają usunięte — dock je zastępuje.

## Siatka bento

Layout: MagicUI `BentoGrid` (kontener CSS grid z wariantami `col-span`).
Kafelki budowane są z shadcn `Card`, **nie** z `BentoCard`.

Uzasadnienie: `BentoCard` ma API nastawione na siatki marketingowe
(`Icon`/`name`/`description`/`href`/`cta` plus maskowana warstwa `background`
z animacją hover). Wstawienie listy lekcji w slot `background` walczyłoby z
jego własnym stylowaniem o czytelność danych. Bierzemy z MagicUI layout,
a treść kafelka budujemy sami.

Kafelki układają się po jednym na konto, responsywnie: 1 kolumna na wąskich
ekranach, 2 od `md`, 3 od `xl`.

## Widok planu lekcji

**Kafelek** (jeden na konto) zawiera: etykietę konta w nagłówku oraz listę
lekcji **na dziś** — godzina, przedmiot, nauczyciel i sala. Gdy dziś jest
sobota lub niedziela, kafelek pokazuje lekcje najbliższego poniedziałku
z etykietą wskazującą, że to nie jest dzisiejszy dzień. Gdy dany dzień nie ma
lekcji, kafelek pokazuje informację o braku lekcji.

**Źródło danych:** bez nowego endpointu. Kafelek korzysta z istniejącego
`GET /api/accounts/:id/timetable` (bieżący tydzień) i wybiera z odpowiedzi
kolumnę dnia — `table[<dzień>]` sparowaną po indeksie z `hours[]`, dokładnie
tak jak robi to dziś tabela tygodniowa.

**Dialog pełnego tygodnia:** kliknięcie kafelka otwiera shadcn `Dialog` z
istniejącym `TimetableView` (pełna tabela + „Poprzedni/Następny tydzień").
Pobrany już tydzień jest przekazywany w dół, więc otwarcie dialogu nie
powoduje ponownego pobrania; dopiero zmiana tygodnia w dialogu pobiera nowe
dane.

**Usuwanie konta** przenosi się do nagłówka tego dialogu (dziś jest w
`TimetableView` przy nazwie konta). Siatka „na jeden rzut oka" zostaje bez
akcji destrukcyjnych.

## Widok wiadomości

**Kafelek** (jeden na konto) zawiera etykietę konta i listę odebranych
wiadomości: nadawca, temat, data. Nieprzeczytane (`read === false`) są
wyróżnione wizualnie. Lista przewija się wewnątrz kafelka.

**Dialog wiadomości:** kliknięcie pozycji otwiera `Dialog` z tematem,
nadawcą, datą i treścią tekstową wiadomości.

## Ładowanie i błędy w siatce

Każdy kafelek pobiera swoje dane **niezależnie i równolegle** (N kont = N
równoległych żądań; menedżer sesji i tak trzyma osobnego klienta Librusa per
konto). Kafelek ma własny stan ładowania i własny stan błędu:

- w trakcie pobierania kafelek pokazuje informację o ładowaniu,
- błąd jednego konta (np. wygasłe hasło po zmianie w Librusie) pokazywany jest
  **wewnątrz jego kafelka** i nie psuje pozostałych kafelków ani całego widoku.

## Backend — nowe endpointy

Oba idą przez istniejący `sessionManager.withSession` (cache klienta per konto
+ jednokrotne ponowienie po ponownym zalogowaniu), zwracają `502` z
`{error: "..."}` przy niepowodzeniu i logują **wyłącznie `error.message`** —
nigdy surowego błędu, który może nieść hasło w `AxiosError.config.data`.

### `GET /api/accounts/:id/messages`

Wywołuje `client.inbox.listInbox(RECEIVED)` gdzie `RECEIVED` to
`config.folder.RECEIVED` (= 5) importowane z `lib/config.js`.

Odpowiedź: tablica `{id, user, title, date, read}` — dokładnie to, co zwraca
biblioteka.

`isExpired`: pusta tablica traktowana jest jako możliwa wygasła sesja
(`Array.isArray(result) && result.length === 0`), analogicznie do pustego
`hours` w planie lekcji. Znany kompromis: konto z faktycznie pustą skrzynką
powoduje jedno zbędne ponowne logowanie.

### `GET /api/accounts/:id/messages/:messageId`

Wywołuje `client.inbox.getMessage(RECEIVED, messageId)`.

**Walidacja:** `messageId` trafia do ścieżki URL wysyłanej do Librusa
(`wiadomosci/1/<folder>/<id>`), więc musi być dodatnią liczbą całkowitą —
w przeciwnym razie `400` i brak żądania do Librusa.

**Kształt odpowiedzi:** `{id, title, user, date, content}`.

Świadomie **nie zwracamy pola `html`** (surowy HTML wiadomości z Synergii)
ani `files` (załączniki). Treść wiadomości pochodzi od osób trzecich — każdy,
kto może napisać do konta, kontroluje ten HTML — więc renderowanie go przez
`dangerouslySetInnerHTML` byłoby wektorem XSS. Zwracamy sam `content`
(tekst), co eliminuje problem bez dokładania sanitizera. Załączniki są poza
zakresem tego spec-a.

`isExpired`: falsy wynik (`_singleMapper` zwraca `0`, gdy nic nie znajdzie)
traktowany jest jako możliwa wygasła sesja.

## Zależności

Nowe w `app/frontend`:

- `framer-motion` — wymagane przez MagicUI `Dock` (animacja magnifikacji).
- Komponenty instalowane CLI: MagicUI `dock`, `bento-grid`; shadcn `dialog`,
  `tooltip`.

MagicUI udostępnia komponenty jako rejestr shadcn. Jeśli nazwa `@magicui/...`
nie zadziała z konfiguracją w `components.json` (pole `registries` jest dziś
puste), należy użyć bezpośredniego URL-a rejestru zamiast dodawać wpis
rejestru na stałe.

Backend nie dostaje nowych zależności.

## Testy

- **Backend** (`node:test`, jak dotychczas): dla obu endpointów — poprawna
  odpowiedź ze stubowanym `inbox.listInbox`/`inbox.getMessage`, `502` gdy
  Librus zawodzi, `400` dla niepoprawnego `messageId`, oraz test
  potwierdzający, że pole `html` **nie** pojawia się w odpowiedzi.
- **Frontend**: `npm run build` (prawdziwy type-check) oraz manualna
  weryfikacja w przeglądarce: przełączanie widoków dockiem, siatka obu
  widoków, oba dialogi, tryb jasny i ciemny.
- **Całość**: `docker compose up --build` jako smoke test.

## Zgodność z poprzednim spec-em

Bez zmian pozostają: brak logowania do samej aplikacji (single-user, wiele
kont Librus), szyfrowanie haseł AES-256-GCM i fail-fast na brak
`ACCOUNTS_ENC_KEY`, brak cache'owania danych z Librusa, nietykalne `lib/`
i główny `package.json`.

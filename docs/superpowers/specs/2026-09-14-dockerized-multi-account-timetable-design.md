# Dockerized multi-account Librus timetable app

Data: 2026-09-14
Branch: `feat/dockerize`

## Cel

`librus-api` to obecnie czysta biblioteka npm (klient HTTP scrapujący Synergię
Librus) — bez serwera, UI ani koncepcji "kont". Ten spec opisuje nową aplikację
zbudowaną na tej bibliotece: single-user narzędzie do logowania się na więcej
niż dwa konta Librus naraz (np. kilkoro dzieci) i podglądu ich planu lekcji,
uruchamiane przez `docker compose`.

## Zakres

- Dodanie/usuwanie kont Librus (login + hasło do Synergii) z poziomu UI.
- Podgląd planu lekcji (bieżący tydzień, z przełącznikiem tydzień wstecz/w
  przód) dla wybranego konta.
- Brak systemu logowania do samej aplikacji — jeden użytkownik, wiele kont
  Librus. Poza zakresem: multi-tenant, role, uprawnienia.
- Poza zakresem: cache'owanie planu lekcji, produkcyjny reverse proxy /
  deployment (to osobny temat, jak w innych projektach — Komodo itp.).

## Architektura

Nowy kod żyje w tym samym repo, obok istniejącej biblioteki w `lib/`:

```
librus-api/
  lib/                  # istniejąca biblioteka (bez zmian)
  app/
    backend/            # Express API, używa lib/ lokalnie
    frontend/           # React + Vite (wzorem injection-tracker)
  docker-compose.yml
  .env.example
```

`app/backend` importuje `Librus` z `lib/` (lokalna zależność w obrębie repo,
bez publikowania do npm).

### Serwisy (docker-compose)

- `backend` — Express, port 3001, wolumen `data:/data` na plik SQLite, env
  `ACCOUNTS_ENC_KEY`.
- `frontend` — build Vite serwowany przez nginx w kontenerze, port 3000,
  `depends_on: [backend]`, proxuje `/api` do `backend`.

### Sesje Librus

`librus-api` trzyma sesję jako cookie jar w pamięci instancji `Librus`.
Backend trzyma per-konto instancję klienta w mapie w pamięci procesu (klucz =
`account.id`). Gdy wywołanie do Synergii wskazuje na wygasłą sesję
(przekierowanie na stronę logowania / brak oczekiwanych danych w odpowiedzi),
backend automatycznie loguje się ponownie zapisanym loginem/hasłem i ponawia
request jednokrotnie.

Restart kontenera backendu czyści cache sesji w pamięci — nieszkodliwe, bo
re-login następuje automatycznie przy pierwszym kolejnym żądaniu do danego
konta.

## Model danych

SQLite (`better-sqlite3`), plik w wolumenie Docker. Jedna tabela:

```sql
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  login TEXT NOT NULL,
  password_encrypted BLOB NOT NULL,
  created_at TEXT NOT NULL
);
```

- `label` — dowolna nazwa do rozróżniania kont w UI (np. imię dziecka).
- `password_encrypted` — AES-256-GCM, klucz z env `ACCOUNTS_ENC_KEY`
  (wymagany przy starcie backendu, generowany raz, trzymany w `.env` poza
  repo; `.env.example` w repo ma tylko placeholder).
- Deszyfrowane hasło istnieje wyłącznie chwilowo w pamięci procesu, w
  momencie (re)autoryzacji do Synergii — nigdy nie jest logowane ani
  zwracane przez API.

Brak cache'owania planu lekcji w DB: `getTimetable()` to jeden tani request
do Synergii, więc backend pyta ją za każdym razem zamiast zarządzać
unieważnianiem cache'u.

## API (backend)

- `GET /api/accounts` — lista kont: `{id, label, login}[]` (bez hasła).
- `POST /api/accounts` — `{label, login, password}`. Backend najpierw próbuje
  zalogować się do Synergii tymi danymi; sukces → zapis (hasło zaszyfrowane);
  błąd logowania → `401`, nic nie zapisujemy.
- `DELETE /api/accounts/:id` — usuwa konto i jego cache'owaną w pamięci
  instancję klienta.
- `GET /api/accounts/:id/timetable?from=&to=` — plan lekcji dla konta i
  zakresu dat (domyślnie bieżący tydzień, zgodnie z domyślnym zachowaniem
  `Calendar.getTimetable`).

## Frontend

React + Vite, struktura wzorem `injection-tracker` (bez Tailwind/shadcn —
zwykły CSS, chyba że w trakcie implementacji okaże się to niewystarczające).

- **Ekran startowy** — lista dodanych kont jako kafelki (`label`) + przycisk
  "Dodaj konto" otwierający formularz (`label`, `login`, `password`).
- **Widok konta** — plan lekcji bieżącego tygodnia w tabeli dzień×godzina
  (z danych `getTimetable`), z nawigacją tydzień wstecz/w przód.
- Brak routingu między "użytkownikami apki" — nawigacja to tylko lista kont →
  plan lekcji wybranego konta.

## Bezpieczeństwo

- Hasła Librusa nigdy nie trafiają do repo, logów ani odpowiedzi API.
- `ACCOUNTS_ENC_KEY` wymagany przy starcie backendu — brak klucza = backend
  nie startuje (fail-fast zamiast cichego zapisu plaintext).
- `.env` w `.gitignore`; `.env.example` z placeholderem w repo.

## Testowanie

- Backend: testy jednostkowe na szyfrowaniu/deszyfrowaniu hasła i na logice
  wykrywania wygasłej sesji + re-login (z zamockowanym `Librus`/HTTP).
- Frontend: manualna weryfikacja przez `run`/przeglądarkę (dodanie konta,
  podgląd planu, usunięcie konta) — zgodnie z globalną zasadą testowania UI
  na żywo przed uznaniem zadania za skończone.
- `docker compose up` jako end-to-end smoke test całego stosu.

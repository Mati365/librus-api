# Dock Navigation, Bento Views, and Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-account tab navigation with a MagicUI Dock, show every account's schedule side by side in a bento grid, and add a second bento view listing each account's Librus messages.

**Architecture:** The backend gains one new router (`routes/messages.js`) with two endpoints that reuse the existing per-account session manager. The frontend replaces `Tabs` with a fixed bottom `Dock` that switches between three views held in `App.tsx` state; the calendar and messages views are `BentoGrid` layouts whose cells each fetch their own account's data in parallel, with drill-in dialogs for the full week and for a message body.

**Tech Stack:** Node.js 20, Express, `better-sqlite3`, `node:test`, React 18 + Vite + TypeScript, Tailwind v4, shadcn/ui (radix-nova preset), MagicUI (`dock`, `bento-grid`), framer-motion, Docker.

**Spec:** [docs/superpowers/specs/2026-09-15-dock-bento-messages-design.md](../specs/2026-09-15-dock-bento-messages-design.md)

## Global Constraints

- `lib/` (the published `librus-api` library) is never modified; the app only consumes it via `require`.
- Root `package.json` / `package-lock.json` are never modified.
- Librus passwords are never logged: in every `catch`, log **only `error.message`**, never the raw error (an `AxiosError` can carry the plaintext password in `error.config.data`).
- Message bodies are third-party content: the API returns the plain-text `content` only — the library's raw `html` field must never reach the frontend.
- `messageId` is interpolated into an outbound Librus URL path, so it must be validated as a positive integer before use.
- No caching of Librus data; every request fetches fresh.
- Backend still refuses to start without `ACCOUNTS_ENC_KEY`.
- Generated shadcn/MagicUI components in this project import the class helper as `import { cn } from "cn"` (the `cn` npm package), **not** from `@/lib/utils` — match that in new components.

---

## File Structure

```
app/backend/
  src/routes/messages.js        # NEW: both message endpoints
  src/server.js                 # MODIFY: mount messages router
  test/messages.test.js         # NEW

app/frontend/src/
  api.ts                        # MODIFY: listMessages, getMessage + types
  App.tsx                       # MODIFY: view state, dock, bento views
  components/
    AppDock.tsx                 # NEW: 3-icon bottom dock navigation
    TodayCard.tsx               # NEW: one account's today-lessons bento cell
    TimetableDialog.tsx         # NEW: full-week drill-in dialog
    MessagesCard.tsx            # NEW: one account's inbox bento cell
    MessageDialog.tsx           # NEW: single message body dialog
    TimetableView.tsx           # MODIFY: accept injected timetable, drop delete
    ui/dock.tsx                 # NEW (MagicUI CLI)
    ui/bento-grid.tsx           # NEW (MagicUI CLI)
    ui/dialog.tsx               # NEW (shadcn CLI)
    ui/tooltip.tsx              # NEW (shadcn CLI)
    ui/tabs.tsx                 # DELETE (replaced by the dock)
```

---

## Task 1: Messages API

**Files:**
- Create: `app/backend/src/routes/messages.js`
- Modify: `app/backend/src/server.js`
- Test: `app/backend/test/messages.test.js`

**Interfaces:**
- Consumes: `sessionManager.withSession(accountId, fn, isExpired)` from `app/backend/src/librusSessions.js`; `config.folder.RECEIVED` from `lib/config.js`; the Librus client's `inbox.listInbox(folderId)` and `inbox.getMessage(folderId, messageId)`.
- Produces: `createMessagesRouter({ sessionManager }): express.Router` mounted at `/api/accounts`, exposing `GET /api/accounts/:id/messages` → `{id, user, title, date, read}[]` and `GET /api/accounts/:id/messages/:messageId` → `{id, title, user, date, content}`.

- [ ] **Step 1: Write the failing test**

Create `app/backend/test/messages.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createApp } = require("../src/server.js");

function startApp(librusFactory) {
  process.env.ACCOUNTS_ENC_KEY = crypto.randomBytes(32).toString("base64");
  const app = createApp({ dbPath: ":memory:", librusFactory });
  const server = app.listen(0);
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}` };
}

async function createAccount(base) {
  return (
    await fetch(`${base}/api/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Jas", login: "jas", password: "pw" }),
    })
  ).json();
}

test("GET /api/accounts/:id/messages returns the inbox list", async () => {
  const inboxRows = [
    { id: 7, user: "Kowalska Anna", title: "Zebranie", date: "2026-09-10", read: false },
    { id: 8, user: "Nowak Jan", title: "Wycieczka", date: "2026-09-11", read: true },
  ];
  const { server, base } = startApp(() => ({
    authorize: async () => {},
    inbox: { listInbox: async () => inboxRows },
  }));
  try {
    const account = await createAccount(base);
    const res = await fetch(`${base}/api/accounts/${account.id}/messages`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), inboxRows);
  } finally {
    server.close();
  }
});

test("GET /api/accounts/:id/messages asks Librus for the RECEIVED folder", async () => {
  let requestedFolder;
  const { server, base } = startApp(() => ({
    authorize: async () => {},
    inbox: {
      listInbox: async (folderId) => {
        requestedFolder = folderId;
        return [{ id: 1, user: "u", title: "t", date: "d", read: true }];
      },
    },
  }));
  try {
    const account = await createAccount(base);
    await fetch(`${base}/api/accounts/${account.id}/messages`);
    assert.equal(requestedFolder, 5);
  } finally {
    server.close();
  }
});

test("GET /api/accounts/:id/messages returns 502 when Librus keeps failing", async () => {
  const { server, base } = startApp(() => ({
    authorize: async () => {},
    inbox: {
      listInbox: async () => {
        throw new Error("boom");
      },
    },
  }));
  try {
    const account = await createAccount(base);
    const res = await fetch(`${base}/api/accounts/${account.id}/messages`);
    assert.equal(res.status, 502);
  } finally {
    server.close();
  }
});

test("GET /api/accounts/:id/messages/:messageId returns the message without raw html", async () => {
  const { server, base } = startApp(() => ({
    authorize: async () => {},
    inbox: {
      getMessage: async () => ({
        title: "Zebranie",
        url: "wiadomosci/1/5/7",
        id: 7,
        folderId: 5,
        date: "2026-09-10",
        user: "Kowalska Anna",
        content: "Zapraszamy na zebranie.",
        html: "<b>Zapraszamy na zebranie.</b><script>alert(1)</script>",
        read: true,
        files: [{ name: "plan.pdf", path: "wiadomosci/pobierz_zalacznik/1/2" }],
      }),
    },
  }));
  try {
    const account = await createAccount(base);
    const res = await fetch(`${base}/api/accounts/${account.id}/messages/7`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.deepEqual(body, {
      id: 7,
      title: "Zebranie",
      user: "Kowalska Anna",
      date: "2026-09-10",
      content: "Zapraszamy na zebranie.",
    });
    assert.equal(body.html, undefined);
    assert.equal(body.files, undefined);
  } finally {
    server.close();
  }
});

test("GET /api/accounts/:id/messages/:messageId rejects a non-numeric id without calling Librus", async () => {
  let called = false;
  const { server, base } = startApp(() => ({
    authorize: async () => {},
    inbox: {
      getMessage: async () => {
        called = true;
        return { title: "x", user: "u", date: "d", content: "c" };
      },
    },
  }));
  try {
    const account = await createAccount(base);
    const res = await fetch(`${base}/api/accounts/${account.id}/messages/not-a-number`);
    assert.equal(res.status, 400);
    assert.equal(called, false);
  } finally {
    server.close();
  }
});

test("GET /api/accounts/:id/messages/:messageId returns 404 when the message is missing", async () => {
  const { server, base } = startApp(() => ({
    authorize: async () => {},
    inbox: { getMessage: async () => 0 },
  }));
  try {
    const account = await createAccount(base);
    const res = await fetch(`${base}/api/accounts/${account.id}/messages/7`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app/backend && npm test`
Expected: FAIL — the `/messages` routes are not mounted, so the list test gets a 404 HTML response instead of JSON.

- [ ] **Step 3: Write `app/backend/src/routes/messages.js`**

```js
"use strict";
const express = require("express");
const config = require("../../../../lib/config.js");

const RECEIVED = config.folder.RECEIVED;

function createMessagesRouter({ sessionManager }) {
  const router = express.Router();

  router.get("/:id/messages", async (req, res) => {
    const accountId = Number(req.params.id);

    try {
      const messages = await sessionManager.withSession(
        accountId,
        (client) => client.inbox.listInbox(RECEIVED),
        (result) => Array.isArray(result) && result.length === 0
      );
      res.json(messages);
    } catch (error) {
      // Log only error.message — the raw error can carry the plaintext Librus password in error.config.data
      console.error("librus inbox fetch failed for account %s: %s", req.params.id, error.message);
      res.status(502).json({ error: "Failed to fetch messages from Librus" });
    }
  });

  router.get("/:id/messages/:messageId", async (req, res) => {
    const accountId = Number(req.params.id);
    const messageId = Number(req.params.messageId);

    if (!Number.isInteger(messageId) || messageId <= 0) {
      return res.status(400).json({ error: "messageId must be a positive integer" });
    }

    try {
      const message = await sessionManager.withSession(
        accountId,
        (client) => client.inbox.getMessage(RECEIVED, messageId),
        (result) => !result
      );

      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Only plain-text content crosses this boundary: message.html is third-party
      // markup and rendering it in the browser would be an XSS vector.
      res.json({
        id: messageId,
        title: message.title,
        user: message.user,
        date: message.date,
        content: message.content,
      });
    } catch (error) {
      // Log only error.message — the raw error can carry the plaintext Librus password in error.config.data
      console.error("librus message fetch failed for account %s: %s", req.params.id, error.message);
      res.status(502).json({ error: "Failed to fetch message from Librus" });
    }
  });

  return router;
}

module.exports = { createMessagesRouter };
```

- [ ] **Step 4: Mount the router in `app/backend/src/server.js`**

Add the import next to the existing route imports:

```js
const { createMessagesRouter } = require("./routes/messages.js");
```

And mount it directly after the existing timetable router mount:

```js
app.use("/api/accounts", createMessagesRouter({ sessionManager }));
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app/backend && npm test`
Expected: PASS — 27 tests (21 existing + 6 new), output pristine apart from the deliberate `console.error` lines printed by the 502 test.

- [ ] **Step 6: Commit**

```bash
git add app/backend/src/routes/messages.js app/backend/src/server.js app/backend/test/messages.test.js
git commit -m "feat: add messages API with folder and id validation"
```

---

## Task 2: Install the Dock, BentoGrid, Dialog, and Tooltip components

**Files:**
- Create: `app/frontend/src/components/ui/dock.tsx`, `app/frontend/src/components/ui/bento-grid.tsx`, `app/frontend/src/components/ui/dialog.tsx`, `app/frontend/src/components/ui/tooltip.tsx` (all CLI-generated)
- Modify: `app/frontend/package.json`, `app/frontend/package-lock.json`

**Interfaces:**
- Produces: `Dock` / `DockIcon` from `./ui/dock`, `BentoGrid` from `./ui/bento-grid`, shadcn `Dialog` family from `./ui/dialog`, `Tooltip` family from `./ui/tooltip` — all consumed by Tasks 3-6.

- [ ] **Step 1: Install the shadcn components**

Run: `cd app/frontend && npx shadcn@latest add dialog tooltip -y`
Expected: creates `src/components/ui/dialog.tsx` and `src/components/ui/tooltip.tsx`.

- [ ] **Step 2: Install the MagicUI components**

Run: `cd app/frontend && npx shadcn@latest add https://magicui.design/r/dock.json -y`
Then: `cd app/frontend && npx shadcn@latest add https://magicui.design/r/bento-grid.json -y`

If the registry URL form is rejected, retry with the namespaced form the MagicUI docs use: `npx shadcn@latest add @magicui/dock -y` (and `@magicui/bento-grid`). If that also fails because `components.json` has no `registries` entry, add one for `@magicui` pointing at `https://magicui.design/r/{name}.json`, then retry.

Expected: creates `src/components/ui/dock.tsx` and `src/components/ui/bento-grid.tsx`.

- [ ] **Step 3: Install the animation dependency**

The MagicUI dock needs an animation library. Open `src/components/ui/dock.tsx` and check which package it imports — recent MagicUI releases import from `motion/react`, older ones from `framer-motion`.

Run whichever matches: `cd app/frontend && npm install motion` **or** `cd app/frontend && npm install framer-motion`

(The shadcn CLI may already have installed it as a registry dependency — check `package.json` first and skip this step if it is already there.)

- [ ] **Step 4: Verify the build**

Run: `cd app/frontend && npm run build`
Expected: exit 0, no TypeScript errors.

- [ ] **Step 5: Record the generated APIs in your report**

The later tasks are written against the documented MagicUI API (`Dock` accepts `className`, `iconSize`, `iconMagnification`, `iconDistance`, `direction`, `disableMagnification`; `DockIcon` accepts `className` and wraps its children). Read both generated files and record in your report:
- the exact exported names from `dock.tsx` and `bento-grid.tsx`,
- whether `bento-grid.tsx` exports `BentoGrid` separately from `BentoCard`,
- whether the generated `tooltip.tsx` exports a `TooltipProvider` that must wrap tooltips (older shadcn) or handles it internally (newer shadcn).

Later tasks must follow the generated source where it differs from the above; note any such difference in your report.

- [ ] **Step 6: Commit**

```bash
git add app/frontend/src/components/ui app/frontend/package.json app/frontend/package-lock.json
git commit -m "feat: install dock, bento-grid, dialog and tooltip components"
```

---

## Task 3: Dock navigation and the calendar bento grid

**Files:**
- Create: `app/frontend/src/components/AppDock.tsx`, `app/frontend/src/components/TodayCard.tsx`
- Modify: `app/frontend/src/App.tsx`
- Delete: `app/frontend/src/components/ui/tabs.tsx`

**Interfaces:**
- Consumes: `Dock` / `DockIcon` (Task 2), `BentoGrid` (Task 2), `Tooltip` family (Task 2), existing `getTimetable(id, from?, to?)` / `Account` / `Timetable` from `../api`, existing `Card` family and `Alert` family.
- Produces: `View` type (`"calendar" | "messages" | "add"`) and default-exported `AppDock({ view, onChange })` from `./components/AppDock`; default-exported `TodayCard({ account })` from `./components/TodayCard`. Task 4 extends `TodayCard`; Task 5 adds the third dock item.

This task ships a two-item dock (calendar, add account); the mail item arrives with the messages view in Task 5.

- [ ] **Step 1: Create `app/frontend/src/components/AppDock.tsx`**

```tsx
import { CalendarDays, UserPlus } from "lucide-react";
import { cn } from "cn";
import { Dock, DockIcon } from "./ui/dock";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export type View = "calendar" | "messages" | "add";

type DockItem = {
  view: View;
  label: string;
  Icon: typeof CalendarDays;
};

const ITEMS: DockItem[] = [
  { view: "calendar", label: "Plan lekcji", Icon: CalendarDays },
  { view: "add", label: "Dodaj konto", Icon: UserPlus },
];

export default function AppDock({
  view,
  onChange,
}: {
  view: View;
  onChange: (view: View) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <Dock>
        {ITEMS.map(({ view: itemView, label, Icon }) => (
          <DockIcon key={itemView}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  aria-current={view === itemView}
                  onClick={() => onChange(itemView)}
                  className={cn(
                    "flex size-full items-center justify-center rounded-full transition-colors",
                    view === itemView
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          </DockIcon>
        ))}
      </Dock>
    </div>
  );
}
```

If Task 2 reported that the generated `tooltip.tsx` exports `TooltipProvider`, wrap the `<Dock>` element in `<TooltipProvider>`.

- [ ] **Step 2: Create `app/frontend/src/components/TodayCard.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Account, getTimetable, Timetable } from "../api";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";

const DAY_KEYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAY_LABELS: Record<string, string> = {
  Monday: "Poniedziałek",
  Tuesday: "Wtorek",
  Wednesday: "Środa",
  Thursday: "Czwartek",
  Friday: "Piątek",
};

// Saturday and Sunday are never school days, so the weekend shows the coming Monday instead.
export function schoolDayFor(now: Date): { key: string; isToday: boolean } {
  const day = now.getDay();
  if (day === 0 || day === 6) return { key: "Monday", isToday: false };
  return { key: DAY_KEYS[day], isToday: true };
}

export default function TodayCard({ account }: { account: Account }) {
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    getTimetable(account.id)
      .then(setTimetable)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać planu")
      );
  }, [account.id]);

  const { key, isToday } = schoolDayFor(new Date());
  const lessons = timetable
    ? timetable.hours
        .map((hour, index) => ({ hour, lesson: timetable.table[key]?.[index] ?? null }))
        .filter((row) => row.lesson !== null)
    : [];

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{account.label}</CardTitle>
        <span className="text-sm text-muted-foreground">
          {isToday ? `Dziś — ${DAY_LABELS[key]}` : `Najbliższy dzień nauki — ${DAY_LABELS[key]}`}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!error && !timetable && <p className="text-sm text-muted-foreground">Ładowanie…</p>}
        {!error && timetable && lessons.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak lekcji.</p>
        )}
        {lessons.map(({ hour, lesson }) => (
          <div key={hour} className="flex gap-3 text-sm">
            <span className="w-28 shrink-0 text-muted-foreground">{hour}</span>
            <span className="flex flex-col">
              <span>{lesson!.subject}</span>
              <span className="text-muted-foreground">
                {lesson!.teacher} {lesson!.room}
              </span>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Rewrite `app/frontend/src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Account, listAccounts } from "./api";
import AddAccountForm from "./components/AddAccountForm";
import AppDock, { View } from "./components/AppDock";
import TodayCard from "./components/TodayCard";
import { Alert, AlertDescription } from "./components/ui/alert";
import { BentoGrid } from "./components/ui/bento-grid";

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("calendar");

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Nie udało się załadować kont")
      )
      .finally(() => setLoading(false));
  }, []);

  function handleAdded(account: Account) {
    setAccounts((prev) => [...prev, account]);
    setView("calendar");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;

  return (
    <main className="flex flex-col gap-4 pb-28">
      <h1 className="font-heading text-2xl font-medium">Plan lekcji Librus</h1>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {view === "add" && (
        <div className="max-w-sm">
          <AddAccountForm onAdded={handleAdded} />
        </div>
      )}

      {view === "calendar" &&
        (accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Dodaj pierwsze konto Librus, żeby zobaczyć plan lekcji.
          </p>
        ) : (
          <BentoGrid className="grid-cols-1 auto-rows-auto md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <TodayCard key={account.id} account={account} />
            ))}
          </BentoGrid>
        ))}

      <AppDock view={view} onChange={setView} />
    </main>
  );
}
```

`BentoGrid` ships its own grid defaults (typically `grid-cols-3` with a fixed `auto-rows`); it composes incoming `className` through `cn()`, so the classes above win. If Task 2's report shows it does not accept `className`, wrap the cells in a plain `div` with those grid classes instead and note it in your report.

- [ ] **Step 4: Delete the now-unused tabs component**

```bash
git rm app/frontend/src/components/ui/tabs.tsx
```

- [ ] **Step 5: Verify the build**

Run: `cd app/frontend && npm run build`
Expected: exit 0, no TypeScript errors. A failure naming `tabs` means something still imports it — remove that import.

- [ ] **Step 6: Commit**

```bash
git add app/frontend/src/App.tsx app/frontend/src/components/AppDock.tsx app/frontend/src/components/TodayCard.tsx
git commit -m "feat: replace tabs with dock navigation and a today-at-a-glance grid"
```

---

## Task 4: Full-week dialog with the account delete action

**Files:**
- Create: `app/frontend/src/components/TimetableDialog.tsx`
- Modify: `app/frontend/src/components/TimetableView.tsx`, `app/frontend/src/components/TodayCard.tsx`, `app/frontend/src/App.tsx`

**Interfaces:**
- Consumes: shadcn `Dialog` family (Task 2), `TodayCard` (Task 3), existing `TimetableView`, `deleteAccount` from `../api`.
- Produces: default-exported `TimetableDialog({ account, initialTimetable, open, onOpenChange, onDeleted })`; `TodayCard` gains an `onDeleted: (id: number) => void` prop and becomes clickable; `TimetableView` gains an `initialTimetable: Timetable | null` prop and loses its own delete action.

- [ ] **Step 1: Give `TimetableView` an injected first week and remove its delete action**

In `app/frontend/src/components/TimetableView.tsx`, change the import line to drop `deleteAccount`:

```tsx
import { Account, getTimetable, Timetable } from "../api";
```

Replace the component signature and the effect so week 0 reuses the already-fetched timetable:

```tsx
export default function TimetableView({
  account,
  initialTimetable,
}: {
  account: Account;
  initialTimetable: Timetable | null;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [timetable, setTimetable] = useState<Timetable | null>(initialTimetable);
  const [error, setError] = useState<string | null>(null);

  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  useEffect(() => {
    if (weekOffset === 0 && initialTimetable) {
      setError(null);
      setTimetable(initialTimetable);
      return;
    }
    setError(null);
    setTimetable(null);
    getTimetable(account.id, formatDate(monday), formatDate(sunday))
      .then(setTimetable)
      .catch((err) => setError(err instanceof Error ? err.message : "Nie udało się pobrać planu"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, weekOffset]);
```

Delete the `handleDelete` function entirely, and replace the header block (the `<div className="flex items-center justify-between">` containing the `<h2>` and the "Usuń to konto" button) with just the week navigation that follows it — the dialog now owns both the title and the delete action. The component's returned JSX starts at the `<div className="flex items-center gap-3">` week-navigation row.

- [ ] **Step 2: Create `app/frontend/src/components/TimetableDialog.tsx`**

```tsx
import { Account, deleteAccount, Timetable } from "../api";
import TimetableView from "./TimetableView";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export default function TimetableDialog({
  account,
  initialTimetable,
  open,
  onOpenChange,
  onDeleted,
}: {
  account: Account;
  initialTimetable: Timetable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: number) => void;
}) {
  async function handleDelete() {
    try {
      await deleteAccount(account.id);
      onOpenChange(false);
      onDeleted(account.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Nie udało się usunąć konta");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{account.label}</DialogTitle>
          <DialogDescription>Plan lekcji na cały tydzień</DialogDescription>
        </DialogHeader>
        <TimetableView account={account} initialTimetable={initialTimetable} />
        <Button variant="ghost" size="sm" onClick={handleDelete} className="self-start">
          Usuń to konto
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Make `TodayCard` open the dialog**

In `app/frontend/src/components/TodayCard.tsx`, add the import:

```tsx
import TimetableDialog from "./TimetableDialog";
```

Change the props and add dialog state:

```tsx
export default function TodayCard({
  account,
  onDeleted,
}: {
  account: Account;
  onDeleted: (id: number) => void;
}) {
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
```

Make the card clickable by replacing its opening tag:

```tsx
    <Card
      className="flex cursor-pointer flex-col transition-colors hover:bg-muted/50"
      onClick={() => setOpen(true)}
    >
```

And render the dialog as the last child inside the `<Card>`, immediately after `</CardContent>`:

```tsx
      <TimetableDialog
        account={account}
        initialTimetable={timetable}
        open={open}
        onOpenChange={setOpen}
        onDeleted={onDeleted}
      />
```

- [ ] **Step 4: Pass the delete handler from `App.tsx`**

Add the handler next to `handleAdded`:

```tsx
  function handleDeleted(id: number) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }
```

And pass it to the card:

```tsx
              <TodayCard key={account.id} account={account} onDeleted={handleDeleted} />
```

- [ ] **Step 5: Verify the build**

Run: `cd app/frontend && npm run build`
Expected: exit 0, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add app/frontend/src/components/TimetableDialog.tsx app/frontend/src/components/TimetableView.tsx app/frontend/src/components/TodayCard.tsx app/frontend/src/App.tsx
git commit -m "feat: open the full week in a dialog and move delete into it"
```

---

## Task 5: Messages bento view

**Files:**
- Modify: `app/frontend/src/api.ts`, `app/frontend/src/components/AppDock.tsx`, `app/frontend/src/App.tsx`
- Create: `app/frontend/src/components/MessagesCard.tsx`

**Interfaces:**
- Consumes: `GET /api/accounts/:id/messages` (Task 1), `BentoGrid` (Task 2), `Card`/`Alert` families.
- Produces: `Message` and `MessageDetail` types plus `listMessages(id)` and `getMessage(id, messageId)` in `api.ts`; default-exported `MessagesCard({ account })`. Task 6 extends `MessagesCard` with the body dialog.

- [ ] **Step 1: Add the message calls to `app/frontend/src/api.ts`**

Append the types next to the existing ones:

```ts
export interface Message {
  id: number;
  user: string;
  title: string;
  date: string;
  read: boolean;
}

export interface MessageDetail {
  id: number;
  title: string;
  user: string;
  date: string;
  content: string;
}
```

And the two calls at the end of the file:

```ts
export function listMessages(id: number): Promise<Message[]> {
  return fetch(`${BASE}/${id}/messages`).then((res) => asJson<Message[]>(res));
}

export function getMessage(id: number, messageId: number): Promise<MessageDetail> {
  return fetch(`${BASE}/${id}/messages/${messageId}`).then((res) => asJson<MessageDetail>(res));
}
```

- [ ] **Step 2: Create `app/frontend/src/components/MessagesCard.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Account, listMessages, Message } from "../api";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";

export default function MessagesCard({ account }: { account: Account }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    listMessages(account.id)
      .then(setMessages)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać wiadomości")
      );
  }, [account.id]);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{account.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!error && !messages && <p className="text-sm text-muted-foreground">Ładowanie…</p>}
        {!error && messages && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak wiadomości.</p>
        )}
        {messages?.map((message) => (
          <div key={message.id} className="flex flex-col text-sm">
            <span className={message.read ? "" : "font-medium"}>{message.title}</span>
            <span className="text-muted-foreground">
              {message.user} · {message.date}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Add the mail item to `app/frontend/src/components/AppDock.tsx`**

Change the icon import:

```tsx
import { CalendarDays, Mail, UserPlus } from "lucide-react";
```

And insert the messages entry between the two existing items:

```tsx
const ITEMS: DockItem[] = [
  { view: "calendar", label: "Plan lekcji", Icon: CalendarDays },
  { view: "messages", label: "Wiadomości", Icon: Mail },
  { view: "add", label: "Dodaj konto", Icon: UserPlus },
];
```

- [ ] **Step 4: Render the messages view in `app/frontend/src/App.tsx`**

Add the import:

```tsx
import MessagesCard from "./components/MessagesCard";
```

And add the view block directly after the `view === "calendar"` block:

```tsx
      {view === "messages" &&
        (accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Dodaj pierwsze konto Librus, żeby zobaczyć wiadomości.
          </p>
        ) : (
          <BentoGrid className="grid-cols-1 auto-rows-auto md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <MessagesCard key={account.id} account={account} />
            ))}
          </BentoGrid>
        ))}
```

- [ ] **Step 5: Verify the build**

Run: `cd app/frontend && npm run build`
Expected: exit 0, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add app/frontend/src/api.ts app/frontend/src/components/MessagesCard.tsx app/frontend/src/components/AppDock.tsx app/frontend/src/App.tsx
git commit -m "feat: add messages bento view and dock entry"
```

---

## Task 6: Message body dialog

**Files:**
- Create: `app/frontend/src/components/MessageDialog.tsx`
- Modify: `app/frontend/src/components/MessagesCard.tsx`

**Interfaces:**
- Consumes: `getMessage(id, messageId)` and `MessageDetail` (Task 5), shadcn `Dialog` family (Task 2).
- Produces: default-exported `MessageDialog({ accountId, message, open, onOpenChange })`.

- [ ] **Step 1: Create `app/frontend/src/components/MessageDialog.tsx`**

```tsx
import { useEffect, useState } from "react";
import { getMessage, Message, MessageDetail } from "../api";
import { Alert, AlertDescription } from "./ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export default function MessageDialog({
  accountId,
  message,
  open,
  onOpenChange,
}: {
  accountId: number;
  message: Message;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDetail(null);
    getMessage(accountId, message.id)
      .then(setDetail)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać wiadomości")
      );
  }, [open, accountId, message.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{message.title}</DialogTitle>
          <DialogDescription>
            {message.user} · {message.date}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!error && !detail && <p className="text-sm text-muted-foreground">Ładowanie…</p>}
        {detail && <p className="text-sm whitespace-pre-wrap">{detail.content}</p>}
      </DialogContent>
    </Dialog>
  );
}
```

The body is rendered as text inside `<p>`, never with `dangerouslySetInnerHTML` — the API deliberately sends plain text only.

- [ ] **Step 2: Open the dialog from `MessagesCard`**

In `app/frontend/src/components/MessagesCard.tsx`, add the import:

```tsx
import MessageDialog from "./MessageDialog";
```

Add the selection state next to the existing state:

```tsx
  const [selected, setSelected] = useState<Message | null>(null);
```

Replace the message row with a clickable button:

```tsx
        {messages?.map((message) => (
          <button
            key={message.id}
            type="button"
            onClick={() => setSelected(message)}
            className="flex flex-col rounded-md p-1 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <span className={message.read ? "" : "font-medium"}>{message.title}</span>
            <span className="text-muted-foreground">
              {message.user} · {message.date}
            </span>
          </button>
        ))}
```

And render the dialog as the last child inside `<CardContent>`:

```tsx
        {selected && (
          <MessageDialog
            accountId={account.id}
            message={selected}
            open={selected !== null}
            onOpenChange={(next) => !next && setSelected(null)}
          />
        )}
```

- [ ] **Step 3: Verify the build**

Run: `cd app/frontend && npm run build`
Expected: exit 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/frontend/src/components/MessageDialog.tsx app/frontend/src/components/MessagesCard.tsx
git commit -m "feat: read a message body in a dialog"
```

---

## Task 7: Full-stack verification

**Files:**
- No source changes expected. Any fix this task uncovers is committed here with its own explanation.

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: evidence that the composed stack runs under `docker compose`.

- [ ] **Step 1: Run the backend suite**

Run: `cd app/backend && npm test`
Expected: 27 passing, 0 failing.

- [ ] **Step 2: Build the frontend**

Run: `cd app/frontend && npm run build`
Expected: exit 0. Then delete the incidental build artifact: `rm -f app/frontend/tsconfig.tsbuildinfo`

- [ ] **Step 3: Build and start the stack**

Run:
```bash
echo "ACCOUNTS_ENC_KEY=$(openssl rand -base64 32)" > .env
docker compose up --build -d
```
Expected: both containers build and stay up (`docker compose ps`).

- [ ] **Step 4: Smoke-test the API through the containers**

Run:
```bash
curl -s http://127.0.0.1:3001/health
curl -s http://localhost:3000/api/accounts
```
Expected: `{"status":"ok"}` and `[]` (the second proves nginx still proxies `/api` to the backend).

- [ ] **Step 5: Stop the stack**

Run: `docker compose down`

- [ ] **Step 6: Report what could not be verified**

Automated checks cannot exercise a real Librus login. In your report, state explicitly that the dock/bento/messages flows were verified only against stubs and a running-but-empty stack, and that a manual pass with a real Librus account is still outstanding.

- [ ] **Step 7: Commit (only if a fix was needed)**

```bash
git add -A
git commit -m "fix: <what the integration pass uncovered>"
```

---

## Self-Review Notes

- **Spec coverage:** dock with three icons (Tasks 3 + 5), calendar bento of today's lessons with weekend fallback (Task 3), full-week dialog reusing the already-fetched week (Task 4), delete relocated to that dialog (Task 4), messages bento (Task 5), message body dialog (Task 6), both endpoints with folder constant, id validation, 404, and html-stripping (Task 1), per-cell parallel fetch with isolated loading/error (Tasks 3 + 5), tabs deleted (Task 3), `framer-motion`/`motion` dependency (Task 2). Every spec section maps to a task.
- **Type consistency checked:** `View` is defined once in `AppDock.tsx` and imported by `App.tsx`; `Timetable`/`Account` come from `api.ts` unchanged; `Message`/`MessageDetail` are defined in Task 5 and consumed unchanged in Task 6; `TodayCard`'s props grow from `{account}` (Task 3) to `{account, onDeleted}` (Task 4) and `App.tsx` is updated in the same task.
- **Traced test/implementation agreement for Task 1:** each test's first call for an account finds no cached client, so `withSession` logs in and sets `justLoggedIn = true`, which skips the `isExpired` retry — the 404 test's falsy result and the 502 test's thrown error therefore surface on the first attempt, exactly as asserted.
- **No placeholders:** every step contains literal file contents or exact edits; the only conditional instructions (Task 2's registry fallback, Task 3's `TooltipProvider` and `BentoGrid` className notes) name the precise check and the precise alternative.

# Dockerized Multi-Account Timetable App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dockerized, single-user app on top of the existing `librus-api` library that lets one person log in to more than two Librus/Synergia accounts and view each account's weekly timetable.

**Architecture:** Two new services under `app/backend` (Express + SQLite, imports `lib/api.js` directly via relative `require`) and `app/frontend` (React + Vite, built and served by nginx). `docker-compose.yml` at the repo root wires them together with a named volume for the SQLite file. The existing `lib/` library is untouched.

**Tech Stack:** Node.js 20, Express, `better-sqlite3`, Node's built-in `node:test` + `node:assert` (no extra test framework), React + Vite (TypeScript), nginx (frontend static serving + `/api` proxy), Docker / docker compose.

**Spec:** [docs/superpowers/specs/2026-09-14-dockerized-multi-account-timetable-design.md](../specs/2026-09-14-dockerized-multi-account-timetable-design.md)

## Global Constraints

- `lib/` (the published `librus-api` library) is never modified — the new app only consumes it via `require`.
- Librus account passwords are never stored in plaintext, logged, or returned by any API response — only `password_encrypted` (AES-256-GCM via `ACCOUNTS_ENC_KEY`) touches disk.
- Backend refuses to start without `ACCOUNTS_ENC_KEY` set (fail-fast, no silent plaintext fallback).
- No app-level login/multi-tenant system — single user, multiple Librus accounts.
- No timetable caching layer — always fetch fresh from Synergia via `Calendar.getTimetable`.
- Root `package.json` (the published library's manifest) is never modified — Docker builds install the library's own dependencies from the existing root `package.json`/`package-lock.json` as-is.

---

## File Structure

```
librus-api/
  lib/                         # existing library — untouched
  app/
    backend/
      package.json
      Dockerfile
      src/
        server.js               # createApp() + startup
        db.js                   # SQLite schema + accounts store
        crypto.js                # AES-256-GCM encrypt/decrypt + key check
        librusSessions.js        # per-account Librus client cache + retry-on-expiry
        routes/
          accounts.js            # GET/POST/DELETE /api/accounts
          timetable.js           # GET /api/accounts/:id/timetable
      test/
        crypto.test.js
        db.test.js
        librusSessions.test.js
        accounts.test.js
        timetable.test.js
    frontend/
      package.json
      Dockerfile
      nginx.conf
      index.html
      vite.config.ts
      tsconfig.json
      src/
        main.tsx
        App.tsx
        api.ts
        index.css
        components/
          AccountsList.tsx
          AddAccountForm.tsx
          TimetableView.tsx
  docker-compose.yml
  .env.example
  .gitignore                    # modified: allow .env.example, ignore dist/
```

---

## Task 1: Backend scaffold — Express skeleton with health check

**Files:**
- Create: `app/backend/package.json`
- Create: `app/backend/src/server.js`
- Test: `app/backend/test/server.test.js`

**Interfaces:**
- Produces: `createApp(): express.Express` (exported from `app/backend/src/server.js`), currently mounting only `GET /health` → `{ status: "ok" }`.

- [ ] **Step 1: Create `app/backend/package.json`**

```json
{
  "name": "librus-timetable-backend",
  "version": "1.0.0",
  "private": true,
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test test/"
  },
  "dependencies": {
    "express": "^4.19.2",
    "better-sqlite3": "^11.3.0"
  }
}
```

- [ ] **Step 2: Install backend dependencies**

Run: `cd app/backend && npm install`
Expected: creates `app/backend/node_modules` and `app/backend/package-lock.json`, exits 0.

- [ ] **Step 3: Write the failing test**

Create `app/backend/test/server.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/server.js");

test("GET /health returns ok", async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  } finally {
    server.close();
  }
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd app/backend && npm test`
Expected: FAIL — `src/server.js` does not exist / does not export `createApp`.

- [ ] **Step 5: Write `app/backend/src/server.js`**

```js
"use strict";
const express = require("express");

function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`Backend listening on port ${port}`));
}

module.exports = { createApp };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd app/backend && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/backend/package.json app/backend/package-lock.json app/backend/src/server.js app/backend/test/server.test.js
git commit -m "feat: scaffold backend Express app with health check"
```

---

## Task 2: Password encryption module

**Files:**
- Create: `app/backend/src/crypto.js`
- Test: `app/backend/test/crypto.test.js`

**Interfaces:**
- Produces: `encryptPassword(plainText: string): Buffer`, `decryptPassword(blob: Buffer): string`, `getEncryptionKey(): Buffer` (throws if `ACCOUNTS_ENC_KEY` is unset or not a valid base64-encoded 32-byte value) — all exported from `app/backend/src/crypto.js`.

- [ ] **Step 1: Write the failing test**

Create `app/backend/test/crypto.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const TEST_KEY = crypto.randomBytes(32).toString("base64");

test("encryptPassword/decryptPassword round-trip", () => {
  process.env.ACCOUNTS_ENC_KEY = TEST_KEY;
  delete require.cache[require.resolve("../src/crypto.js")];
  const { encryptPassword, decryptPassword } = require("../src/crypto.js");

  const encrypted = encryptPassword("s3cr3t-p@ss");
  assert.ok(Buffer.isBuffer(encrypted));
  assert.equal(decryptPassword(encrypted), "s3cr3t-p@ss");
});

test("getEncryptionKey throws when ACCOUNTS_ENC_KEY is missing", () => {
  delete process.env.ACCOUNTS_ENC_KEY;
  delete require.cache[require.resolve("../src/crypto.js")];
  const { getEncryptionKey } = require("../src/crypto.js");
  assert.throws(() => getEncryptionKey(), /ACCOUNTS_ENC_KEY/);
});

test("getEncryptionKey throws when key does not decode to 32 bytes", () => {
  process.env.ACCOUNTS_ENC_KEY = Buffer.from("too-short").toString("base64");
  delete require.cache[require.resolve("../src/crypto.js")];
  const { getEncryptionKey } = require("../src/crypto.js");
  assert.throws(() => getEncryptionKey(), /32 bytes/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && npm test`
Expected: FAIL — `src/crypto.js` does not exist.

- [ ] **Step 3: Write `app/backend/src/crypto.js`**

```js
"use strict";
const crypto = require("node:crypto");

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const key = process.env.ACCOUNTS_ENC_KEY;
  if (!key) {
    throw new Error("ACCOUNTS_ENC_KEY environment variable is required");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("ACCOUNTS_ENC_KEY must decode to 32 bytes (base64)");
  }
  return buf;
}

function encryptPassword(plainText) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptPassword(blob) {
  const key = getEncryptionKey();
  const iv = blob.subarray(0, 12);
  const authTag = blob.subarray(12, 28);
  const encrypted = blob.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

module.exports = { encryptPassword, decryptPassword, getEncryptionKey };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/backend && npm test`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/crypto.js app/backend/test/crypto.test.js
git commit -m "feat: add AES-256-GCM password encryption module"
```

---

## Task 3: SQLite accounts store

**Files:**
- Create: `app/backend/src/db.js`
- Test: `app/backend/test/db.test.js`

**Interfaces:**
- Produces: `createDb(dbPath: string): Database`, `makeAccountsStore(db: Database): { insert(label, login, passwordEncrypted) => number, list() => {id,label,login}[], get(id) => {id,label,login,password_encrypted}|undefined, remove(id) => void }` — exported from `app/backend/src/db.js`.

- [ ] **Step 1: Write the failing test**

Create `app/backend/test/db.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createDb, makeAccountsStore } = require("../src/db.js");

function freshStore() {
  const db = createDb(":memory:");
  return makeAccountsStore(db);
}

test("insert then list returns account without password", () => {
  const store = freshStore();
  const id = store.insert("Jas", "jas123", Buffer.from("cipher"));
  assert.equal(typeof id, "number");

  const rows = store.list();
  assert.deepEqual(rows, [{ id, label: "Jas", login: "jas123" }]);
});

test("get returns full row including encrypted password", () => {
  const store = freshStore();
  const id = store.insert("Kasia", "kasia456", Buffer.from("cipher-2"));

  const row = store.get(id);
  assert.equal(row.label, "Kasia");
  assert.equal(row.login, "kasia456");
  assert.ok(Buffer.from(row.password_encrypted).equals(Buffer.from("cipher-2")));
});

test("get returns undefined for unknown id", () => {
  const store = freshStore();
  assert.equal(store.get(999), undefined);
});

test("remove deletes the account", () => {
  const store = freshStore();
  const id = store.insert("Ola", "ola789", Buffer.from("cipher-3"));
  store.remove(id);
  assert.equal(store.get(id), undefined);
  assert.deepEqual(store.list(), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && npm test`
Expected: FAIL — `src/db.js` does not exist.

- [ ] **Step 3: Write `app/backend/src/db.js`**

```js
"use strict";
const Database = require("better-sqlite3");

function createDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      login TEXT NOT NULL,
      password_encrypted BLOB NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  return db;
}

function makeAccountsStore(db) {
  const insertStmt = db.prepare(
    "INSERT INTO accounts (label, login, password_encrypted, created_at) VALUES (?, ?, ?, ?)"
  );
  const listStmt = db.prepare("SELECT id, label, login FROM accounts ORDER BY id");
  const getStmt = db.prepare(
    "SELECT id, label, login, password_encrypted FROM accounts WHERE id = ?"
  );
  const deleteStmt = db.prepare("DELETE FROM accounts WHERE id = ?");

  return {
    insert(label, login, passwordEncrypted) {
      const info = insertStmt.run(label, login, passwordEncrypted, new Date().toISOString());
      return Number(info.lastInsertRowid);
    },
    list() {
      return listStmt.all();
    },
    get(id) {
      return getStmt.get(id);
    },
    remove(id) {
      deleteStmt.run(id);
    },
  };
}

module.exports = { createDb, makeAccountsStore };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/backend && npm test`
Expected: PASS (all tests, this file's 4 plus Task 1/2's).

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/db.js app/backend/test/db.test.js
git commit -m "feat: add SQLite accounts store"
```

---

## Task 4: Wire crypto + db into the app, require the encryption key at startup

**Files:**
- Modify: `app/backend/src/server.js`
- Test: `app/backend/test/server.test.js`

**Interfaces:**
- Consumes: `getEncryptionKey()` from `./crypto.js` (Task 2); `createDb(dbPath)`, `makeAccountsStore(db)` from `./db.js` (Task 3).
- Produces: `createApp({ dbPath?: string } = {}): express.Express` — now throws synchronously if `ACCOUNTS_ENC_KEY` is unset/invalid; still serves `GET /health`. `dbPath` defaults to `process.env.DB_PATH || "/data/accounts.db"`; pass `":memory:"` in tests.

- [ ] **Step 1: Extend the failing test**

Add to `app/backend/test/server.test.js` (above the existing `GET /health` test, after the imports):

```js
const crypto = require("node:crypto");

test("createApp throws when ACCOUNTS_ENC_KEY is not set", () => {
  delete process.env.ACCOUNTS_ENC_KEY;
  assert.throws(() => createApp({ dbPath: ":memory:" }), /ACCOUNTS_ENC_KEY/);
});
```

And change the existing `"GET /health returns ok"` test's first line from `const app = createApp();` to:

```js
process.env.ACCOUNTS_ENC_KEY = crypto.randomBytes(32).toString("base64");
const app = createApp({ dbPath: ":memory:" });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && npm test`
Expected: FAIL — `createApp` does not yet call `getEncryptionKey()`, so the throw test fails.

- [ ] **Step 3: Update `app/backend/src/server.js`**

```js
"use strict";
const express = require("express");
const { getEncryptionKey } = require("./crypto.js");
const { createDb, makeAccountsStore } = require("./db.js");

function createApp({ dbPath = process.env.DB_PATH || "/data/accounts.db" } = {}) {
  getEncryptionKey();

  const db = createDb(dbPath);
  const accountsStore = makeAccountsStore(db);

  const app = express();
  app.use(express.json());
  app.locals.accountsStore = accountsStore;

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`Backend listening on port ${port}`));
}

module.exports = { createApp };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/backend && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/server.js app/backend/test/server.test.js
git commit -m "feat: require ACCOUNTS_ENC_KEY at startup, wire db into app"
```

---

## Task 5: Librus session manager (per-account client cache + retry-on-expiry)

**Files:**
- Create: `app/backend/src/librusSessions.js`
- Test: `app/backend/test/librusSessions.test.js`

**Interfaces:**
- Consumes: `decryptPassword(blob)` from `./crypto.js` (Task 2); an `accountsStore.get(id)` shaped like Task 3's store.
- Produces: `createSessionManager({ accountsStore, decryptPassword, librusFactory? }): { withSession(accountId, fn, isExpired?) => Promise<any>, login(accountId) => Promise<client>, forget(accountId) => void }` — exported from `app/backend/src/librusSessions.js`. `librusFactory` defaults to `() => new (require("../../../lib/api.js"))()`; tests override it with a stub.

- [ ] **Step 1: Write the failing test**

Create `app/backend/test/librusSessions.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSessionManager } = require("../src/librusSessions.js");

function stubAccountsStore(row) {
  return { get: () => row };
}

test("withSession logs in once and reuses the cached client", async () => {
  let authorizeCalls = 0;
  const client = { authorize: async () => { authorizeCalls += 1; } };
  const manager = createSessionManager({
    accountsStore: stubAccountsStore({ id: 1, login: "u", password_encrypted: Buffer.from("x") }),
    decryptPassword: () => "plain-pass",
    librusFactory: () => client,
  });

  const first = await manager.withSession(1, async (c) => { assert.equal(c, client); return "first"; });
  const second = await manager.withSession(1, async (c) => { assert.equal(c, client); return "second"; });

  assert.equal(first, "first");
  assert.equal(second, "second");
  assert.equal(authorizeCalls, 1);
});

test("withSession re-logs in and retries once when isExpired reports staleness", async () => {
  let authorizeCalls = 0;
  const client = { authorize: async () => { authorizeCalls += 1; } };
  const manager = createSessionManager({
    accountsStore: stubAccountsStore({ id: 1, login: "u", password_encrypted: Buffer.from("x") }),
    decryptPassword: () => "plain-pass",
    librusFactory: () => client,
  });

  let callCount = 0;
  const result = await manager.withSession(
    1,
    async () => { callCount += 1; return callCount === 1 ? { hours: [] } : { hours: ["8:00"] }; },
    (r) => r.hours.length === 0
  );

  assert.deepEqual(result, { hours: ["8:00"] });
  assert.equal(callCount, 2);
  assert.equal(authorizeCalls, 2);
});

test("withSession does not retry isExpired on a freshly-logged-in client", async () => {
  const client = { authorize: async () => {} };
  const manager = createSessionManager({
    accountsStore: stubAccountsStore({ id: 1, login: "u", password_encrypted: Buffer.from("x") }),
    decryptPassword: () => "plain-pass",
    librusFactory: () => client,
  });

  let callCount = 0;
  const result = await manager.withSession(
    1,
    async () => { callCount += 1; return { hours: [] }; },
    () => true
  );

  assert.deepEqual(result, { hours: [] });
  assert.equal(callCount, 1);
});

test("withSession re-logs in and retries once when fn throws on a cached client", async () => {
  let authorizeCalls = 0;
  const client = { authorize: async () => { authorizeCalls += 1; } };
  const manager = createSessionManager({
    accountsStore: stubAccountsStore({ id: 1, login: "u", password_encrypted: Buffer.from("x") }),
    decryptPassword: () => "plain-pass",
    librusFactory: () => client,
  });

  await manager.withSession(1, async () => "warm-up");

  let callCount = 0;
  const result = await manager.withSession(1, async () => {
    callCount += 1;
    if (callCount === 1) throw new Error("network blip");
    return "recovered";
  });

  assert.equal(result, "recovered");
  assert.equal(callCount, 2);
  assert.equal(authorizeCalls, 2);
});

test("forget drops the cached client so the next call re-logs in", async () => {
  let authorizeCalls = 0;
  const client = { authorize: async () => { authorizeCalls += 1; } };
  const manager = createSessionManager({
    accountsStore: stubAccountsStore({ id: 1, login: "u", password_encrypted: Buffer.from("x") }),
    decryptPassword: () => "plain-pass",
    librusFactory: () => client,
  });

  await manager.withSession(1, async () => "a");
  manager.forget(1);
  await manager.withSession(1, async () => "b");

  assert.equal(authorizeCalls, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && npm test`
Expected: FAIL — `src/librusSessions.js` does not exist.

- [ ] **Step 3: Write `app/backend/src/librusSessions.js`**

```js
"use strict";

function createSessionManager({ accountsStore, decryptPassword, librusFactory }) {
  const factory = librusFactory || (() => new (require("../../../lib/api.js"))());
  const clients = new Map();

  async function login(accountId) {
    const account = accountsStore.get(accountId);
    if (!account) {
      throw new Error(`Unknown account ${accountId}`);
    }
    const password = decryptPassword(account.password_encrypted);
    const client = factory();
    await client.authorize(account.login, password);
    clients.set(accountId, client);
    return client;
  }

  async function withSession(accountId, fn, isExpired = () => false) {
    let client = clients.get(accountId);
    let justLoggedIn = false;
    if (!client) {
      client = await login(accountId);
      justLoggedIn = true;
    }

    let result;
    try {
      result = await fn(client);
    } catch (error) {
      if (justLoggedIn) throw error;
      client = await login(accountId);
      return fn(client);
    }

    if (!justLoggedIn && isExpired(result)) {
      client = await login(accountId);
      return fn(client);
    }

    return result;
  }

  function forget(accountId) {
    clients.delete(accountId);
  }

  return { withSession, login, forget };
}

module.exports = { createSessionManager };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/backend && npm test`
Expected: PASS (all 5 tests in this file, plus earlier tasks').

- [ ] **Step 5: Commit**

```bash
git add app/backend/src/librusSessions.js app/backend/test/librusSessions.test.js
git commit -m "feat: add per-account Librus session manager with retry-on-expiry"
```

---

## Task 6: Accounts API (`GET`/`POST`/`DELETE /api/accounts`)

**Files:**
- Create: `app/backend/src/routes/accounts.js`
- Modify: `app/backend/src/server.js`
- Test: `app/backend/test/accounts.test.js`

**Interfaces:**
- Consumes: `accountsStore` (Task 3 shape), `encryptPassword` (Task 2), `sessionManager.forget` (Task 5), a `librusFactory` used only to validate credentials on `POST`.
- Produces: `createAccountsRouter({ accountsStore, encryptPassword, sessionManager, librusFactory }): express.Router` mounted at `/api/accounts`; `createApp({ dbPath?, librusFactory? })` now also accepts `librusFactory` and constructs `sessionManager` + mounts this router.

- [ ] **Step 1: Write the failing test**

Create `app/backend/test/accounts.test.js`:

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

test("POST /api/accounts rejects invalid Librus credentials without saving", async () => {
  const { server, base } = startApp(() => ({
    authorize: async () => { throw new Error("bad login"); },
  }));
  try {
    const res = await fetch(`${base}/api/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Jas", login: "jas", password: "wrong" }),
    });
    assert.equal(res.status, 401);

    const list = await (await fetch(`${base}/api/accounts`)).json();
    assert.deepEqual(list, []);
  } finally {
    server.close();
  }
});

test("POST then GET /api/accounts returns the account without the password", async () => {
  const { server, base } = startApp(() => ({ authorize: async () => {} }));
  try {
    const created = await (
      await fetch(`${base}/api/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Jas", login: "jas123", password: "correct" }),
      })
    ).json();
    assert.equal(created.label, "Jas");
    assert.equal(created.login, "jas123");
    assert.equal(created.password, undefined);

    const list = await (await fetch(`${base}/api/accounts`)).json();
    assert.deepEqual(list, [{ id: created.id, label: "Jas", login: "jas123" }]);
  } finally {
    server.close();
  }
});

test("POST /api/accounts requires label, login and password", async () => {
  const { server, base } = startApp(() => ({ authorize: async () => {} }));
  try {
    const res = await fetch(`${base}/api/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Jas" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("DELETE /api/accounts/:id removes the account", async () => {
  const { server, base } = startApp(() => ({ authorize: async () => {} }));
  try {
    const created = await (
      await fetch(`${base}/api/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Ola", login: "ola", password: "pw" }),
      })
    ).json();

    const del = await fetch(`${base}/api/accounts/${created.id}`, { method: "DELETE" });
    assert.equal(del.status, 204);

    const list = await (await fetch(`${base}/api/accounts`)).json();
    assert.deepEqual(list, []);
  } finally {
    server.close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && npm test`
Expected: FAIL — no `/api/accounts` routes mounted yet.

- [ ] **Step 3: Write `app/backend/src/routes/accounts.js`**

```js
"use strict";
const express = require("express");

function createAccountsRouter({ accountsStore, encryptPassword, sessionManager, librusFactory }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json(accountsStore.list());
  });

  router.post("/", async (req, res) => {
    const { label, login, password } = req.body || {};
    if (!label || !login || !password) {
      return res.status(400).json({ error: "label, login and password are required" });
    }

    const client = librusFactory();
    try {
      await client.authorize(login, password);
    } catch {
      return res.status(401).json({ error: "Invalid Librus credentials" });
    }

    const id = accountsStore.insert(label, login, encryptPassword(password));
    res.status(201).json({ id, label, login });
  });

  router.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    accountsStore.remove(id);
    sessionManager.forget(id);
    res.status(204).end();
  });

  return router;
}

module.exports = { createAccountsRouter };
```

- [ ] **Step 4: Update `app/backend/src/server.js`**

```js
"use strict";
const express = require("express");
const { getEncryptionKey, encryptPassword, decryptPassword } = require("./crypto.js");
const { createDb, makeAccountsStore } = require("./db.js");
const { createSessionManager } = require("./librusSessions.js");
const { createAccountsRouter } = require("./routes/accounts.js");

function createApp({
  dbPath = process.env.DB_PATH || "/data/accounts.db",
  librusFactory = () => new (require("../../../lib/api.js"))(),
} = {}) {
  getEncryptionKey();

  const db = createDb(dbPath);
  const accountsStore = makeAccountsStore(db);
  const sessionManager = createSessionManager({ accountsStore, decryptPassword, librusFactory });

  const app = express();
  app.use(express.json());
  app.locals.accountsStore = accountsStore;
  app.locals.sessionManager = sessionManager;

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    "/api/accounts",
    createAccountsRouter({ accountsStore, encryptPassword, sessionManager, librusFactory })
  );

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`Backend listening on port ${port}`));
}

module.exports = { createApp };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app/backend && npm test`
Expected: PASS (all tests across all files).

- [ ] **Step 6: Commit**

```bash
git add app/backend/src/routes/accounts.js app/backend/src/server.js app/backend/test/accounts.test.js
git commit -m "feat: add accounts API (list/add/delete with credential validation)"
```

---

## Task 7: Timetable API (`GET /api/accounts/:id/timetable`)

**Files:**
- Create: `app/backend/src/routes/timetable.js`
- Modify: `app/backend/src/server.js`
- Test: `app/backend/test/timetable.test.js`

**Interfaces:**
- Consumes: `sessionManager.withSession(accountId, fn, isExpired)` (Task 5).
- Produces: `createTimetableRouter({ sessionManager }): express.Router` mounted at `/api/accounts`, exposing `GET /api/accounts/:id/timetable?from=&to=` → the object returned by `Calendar.getTimetable` (`{ hours: string[], table: Record<string, (lesson|null)[]> }`), or `502` on failure.

- [ ] **Step 1: Write the failing test**

Create `app/backend/test/timetable.test.js`:

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

test("GET /api/accounts/:id/timetable returns the parsed timetable", async () => {
  const timetable = { hours: ["8:00-8:45"], table: { Monday: [{ subject: "Math", teacher: "T", room: "1", time: "8:00-8:45" }] } };
  const { server, base } = startApp(() => ({
    authorize: async () => {},
    calendar: { getTimetable: async () => timetable },
  }));
  try {
    const account = await createAccount(base);
    const res = await fetch(`${base}/api/accounts/${account.id}/timetable`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), timetable);
  } finally {
    server.close();
  }
});

test("GET /api/accounts/:id/timetable forwards from/to as query params to getTimetable", async () => {
  let receivedArgs;
  const { server, base } = startApp(() => ({
    authorize: async () => {},
    calendar: {
      getTimetable: async (from, to) => {
        receivedArgs = [from, to];
        return { hours: [], table: {} };
      },
    },
  }));
  try {
    const account = await createAccount(base);
    await fetch(`${base}/api/accounts/${account.id}/timetable?from=2026-09-07&to=2026-09-13`);
    assert.deepEqual(receivedArgs, ["2026-09-07", "2026-09-13"]);
  } finally {
    server.close();
  }
});

test("GET /api/accounts/:id/timetable returns 502 when Librus keeps failing", async () => {
  const { server, base } = startApp(() => ({
    authorize: async () => {},
    calendar: { getTimetable: async () => { throw new Error("boom"); } },
  }));
  try {
    const account = await createAccount(base);
    const res = await fetch(`${base}/api/accounts/${account.id}/timetable`);
    assert.equal(res.status, 502);
  } finally {
    server.close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/backend && npm test`
Expected: FAIL — no timetable route mounted yet.

- [ ] **Step 3: Write `app/backend/src/routes/timetable.js`**

```js
"use strict";
const express = require("express");

function createTimetableRouter({ sessionManager }) {
  const router = express.Router();

  router.get("/:id/timetable", async (req, res) => {
    const accountId = Number(req.params.id);
    const { from, to } = req.query;

    try {
      const timetable = await sessionManager.withSession(
        accountId,
        (client) => client.calendar.getTimetable(from, to),
        (result) => Array.isArray(result?.hours) && result.hours.length === 0
      );
      res.json(timetable);
    } catch {
      res.status(502).json({ error: "Failed to fetch timetable from Librus" });
    }
  });

  return router;
}

module.exports = { createTimetableRouter };
```

- [ ] **Step 4: Update `app/backend/src/server.js`**

Add the import and mount (after the `accounts` router mount):

```js
const { createTimetableRouter } = require("./routes/timetable.js");
```

```js
app.use("/api/accounts", createTimetableRouter({ sessionManager }));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app/backend && npm test`
Expected: PASS (all tests across all files).

- [ ] **Step 6: Commit**

```bash
git add app/backend/src/routes/timetable.js app/backend/src/server.js app/backend/test/timetable.test.js
git commit -m "feat: add timetable API with session-expiry retry"
```

---

## Task 8: Frontend scaffold — Vite + React + API client

**Files:**
- Create: `app/frontend/package.json`
- Create: `app/frontend/vite.config.ts`
- Create: `app/frontend/tsconfig.json`
- Create: `app/frontend/index.html`
- Create: `app/frontend/src/main.tsx`
- Create: `app/frontend/src/App.tsx`
- Create: `app/frontend/src/api.ts`
- Create: `app/frontend/src/index.css`

**Interfaces:**
- Produces: `listAccounts()`, `addAccount(label, login, password)`, `deleteAccount(id)`, `getTimetable(id, from?, to?)` and the `Account`/`Timetable`/`TimetableLesson` types from `app/frontend/src/api.ts`, consumed by Tasks 9 and 10.

- [ ] **Step 1: Create `app/frontend/package.json`**

```json
{
  "name": "librus-timetable-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "typescript": "^5.6.2",
    "vite": "^5.4.8"
  }
}
```

- [ ] **Step 2: Create `app/frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `app/frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
```

- [ ] **Step 4: Create `app/frontend/index.html`**

```html
<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Plan lekcji Librus</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `app/frontend/src/api.ts`**

```ts
const BASE = "/api/accounts";

export interface Account {
  id: number;
  label: string;
  login: string;
}

export interface TimetableLesson {
  subject: string;
  teacher: string;
  room: string;
  time: string;
}

export interface Timetable {
  hours: string[];
  table: Record<string, (TimetableLesson | null)[]>;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export function listAccounts(): Promise<Account[]> {
  return fetch(BASE).then((res) => asJson<Account[]>(res));
}

export function addAccount(label: string, login: string, password: string): Promise<Account> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, login, password }),
  }).then((res) => asJson<Account>(res));
}

export async function deleteAccount(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete account ${id}`);
}

export function getTimetable(id: number, from?: string, to?: string): Promise<Timetable> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return fetch(`${BASE}/${id}/timetable${query ? `?${query}` : ""}`).then((res) =>
    asJson<Timetable>(res)
  );
}
```

- [ ] **Step 6: Create `app/frontend/src/index.css`**

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
  padding: 1.5rem;
  max-width: 960px;
  margin-inline: auto;
}

.tile-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tile {
  border: 1px solid #8884;
  border-radius: 0.5rem;
  padding: 1rem 1.5rem;
  cursor: pointer;
  background: none;
  font: inherit;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  border: 1px solid #8884;
  padding: 0.4rem 0.6rem;
  text-align: left;
  vertical-align: top;
}
```

- [ ] **Step 7: Create `app/frontend/src/App.tsx`** (placeholder shell — replaced in Tasks 9-10)

```tsx
export default function App() {
  return <h1>Plan lekcji Librus</h1>;
}
```

- [ ] **Step 8: Create `app/frontend/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: Install dependencies and verify the build**

Run: `cd app/frontend && npm install && npm run build`
Expected: exits 0, produces `app/frontend/dist/`.

- [ ] **Step 10: Commit**

```bash
git add app/frontend/package.json app/frontend/package-lock.json app/frontend/tsconfig.json app/frontend/vite.config.ts app/frontend/index.html app/frontend/src
git commit -m "feat: scaffold frontend Vite + React app with API client"
```

---

## Task 9: Frontend — accounts list and add-account form

**Files:**
- Create: `app/frontend/src/components/AccountsList.tsx`
- Create: `app/frontend/src/components/AddAccountForm.tsx`
- Modify: `app/frontend/src/App.tsx`

**Interfaces:**
- Consumes: `listAccounts`, `addAccount`, `deleteAccount`, `Account` from `../api` (Task 8).
- Produces: `<AccountsList accounts={Account[]} onSelect={(a: Account) => void} onAdded={(a: Account) => void} onDeleted={(id: number) => void} />`, `<AddAccountForm onAdded={(a: Account) => void} />` — consumed by Task 10's `App.tsx` wiring.

- [ ] **Step 1: Create `app/frontend/src/components/AddAccountForm.tsx`**

```tsx
import { useState } from "react";
import { addAccount, Account } from "../api";

export default function AddAccountForm({ onAdded }: { onAdded: (account: Account) => void }) {
  const [label, setLabel] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const account = await addAccount(label, login, password);
      setLabel("");
      setLogin("");
      setPassword("");
      onAdded(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się dodać konta");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>
          Etykieta
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </label>
      </div>
      <div>
        <label>
          Login Synergia
          <input value={login} onChange={(e) => setLogin(e.target.value)} required />
        </label>
      </div>
      <div>
        <label>
          Hasło Synergia
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Dodawanie…" : "Dodaj konto"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create `app/frontend/src/components/AccountsList.tsx`**

```tsx
import { useState } from "react";
import { Account, deleteAccount } from "../api";
import AddAccountForm from "./AddAccountForm";

export default function AccountsList({
  accounts,
  onSelect,
  onAdded,
  onDeleted,
}: {
  accounts: Account[];
  onSelect: (account: Account) => void;
  onAdded: (account: Account) => void;
  onDeleted: (id: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    await deleteAccount(id);
    onDeleted(id);
  }

  return (
    <section>
      <div className="tile-grid">
        {accounts.map((account) => (
          <button key={account.id} className="tile" onClick={() => onSelect(account)}>
            {account.label}
            <div>
              <a href="#" onClick={(e) => handleDelete(e, account.id)}>
                Usuń
              </a>
            </div>
          </button>
        ))}
      </div>

      {showForm ? (
        <AddAccountForm
          onAdded={(account) => {
            onAdded(account);
            setShowForm(false);
          }}
        />
      ) : (
        <button onClick={() => setShowForm(true)}>Dodaj konto</button>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Update `app/frontend/src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Account, listAccounts } from "./api";
import AccountsList from "./components/AccountsList";

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Ładowanie…</p>;

  return (
    <main>
      <h1>Plan lekcji Librus</h1>
      <AccountsList
        accounts={accounts}
        onSelect={() => {}}
        onAdded={(account) => setAccounts((prev) => [...prev, account])}
        onDeleted={(id) => setAccounts((prev) => prev.filter((a) => a.id !== id))}
      />
    </main>
  );
}
```

- [ ] **Step 4: Verify the build**

Run: `cd app/frontend && npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Manual verification**

Run: `cd app/frontend && npm run dev` (with the backend from Tasks 1-7 running separately on port 3001, `ACCOUNTS_ENC_KEY` set, `DB_PATH` pointing at a scratch file). Open the dev URL in a browser, add an account with real or intentionally-wrong Synergia credentials, and confirm: a wrong password shows the error message from the form, a correct login adds a tile, and "Usuń" removes it.

- [ ] **Step 6: Commit**

```bash
git add app/frontend/src/App.tsx app/frontend/src/components/AccountsList.tsx app/frontend/src/components/AddAccountForm.tsx
git commit -m "feat: add accounts list and add-account form UI"
```

---

## Task 10: Frontend — timetable view with week navigation

**Files:**
- Create: `app/frontend/src/components/TimetableView.tsx`
- Modify: `app/frontend/src/App.tsx`

**Interfaces:**
- Consumes: `getTimetable`, `Account`, `Timetable` from `../api` (Task 8).
- Produces: `<TimetableView account={Account} onBack={() => void} />`, wired into `App.tsx`'s `onSelect`.

- [ ] **Step 1: Create `app/frontend/src/components/TimetableView.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Account, getTimetable, Timetable } from "../api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_LABELS: Record<string, string> = {
  Monday: "Poniedziałek",
  Tuesday: "Wtorek",
  Wednesday: "Środa",
  Thursday: "Czwartek",
  Friday: "Piątek",
  Saturday: "Sobota",
  Sunday: "Niedziela",
};

function mondayOf(date: Date): Date {
  const result = new Date(date);
  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);
  return result;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export default function TimetableView({ account, onBack }: { account: Account; onBack: () => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  useEffect(() => {
    setError(null);
    setTimetable(null);
    getTimetable(account.id, formatDate(monday), formatDate(sunday))
      .then(setTimetable)
      .catch((err) => setError(err instanceof Error ? err.message : "Nie udało się pobrać planu"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, weekOffset]);

  return (
    <section>
      <button onClick={onBack}>← Konta</button>
      <h2>{account.label}</h2>
      <div>
        <button onClick={() => setWeekOffset((w) => w - 1)}>← Poprzedni tydzień</button>
        <span>
          {formatDate(monday)} – {formatDate(sunday)}
        </span>
        <button onClick={() => setWeekOffset((w) => w + 1)}>Następny tydzień →</button>
      </div>

      {error && <p role="alert">{error}</p>}
      {!error && !timetable && <p>Ładowanie…</p>}

      {timetable && (
        <table>
          <thead>
            <tr>
              <th>Godzina</th>
              {DAYS.map((day) => (
                <th key={day}>{DAY_LABELS[day]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timetable.hours.map((hour, hourIndex) => (
              <tr key={hour + hourIndex}>
                <td>{hour}</td>
                {DAYS.map((day) => {
                  const lesson = timetable.table[day]?.[hourIndex];
                  return (
                    <td key={day}>
                      {lesson ? (
                        <>
                          <div>{lesson.subject}</div>
                          <div>
                            {lesson.teacher} {lesson.room}
                          </div>
                        </>
                      ) : (
                        ""
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Update `app/frontend/src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Account, listAccounts } from "./api";
import AccountsList from "./components/AccountsList";
import TimetableView from "./components/TimetableView";

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Account | null>(null);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Ładowanie…</p>;

  return (
    <main>
      <h1>Plan lekcji Librus</h1>
      {selected ? (
        <TimetableView account={selected} onBack={() => setSelected(null)} />
      ) : (
        <AccountsList
          accounts={accounts}
          onSelect={setSelected}
          onAdded={(account) => setAccounts((prev) => [...prev, account])}
          onDeleted={(id) => setAccounts((prev) => prev.filter((a) => a.id !== id))}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `cd app/frontend && npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Manual verification**

With the backend running (Tasks 1-7) and at least one account added (Task 9's manual step), run `cd app/frontend && npm run dev`, select an account tile, confirm the timetable table renders for the current week, and that "Poprzedni tydzień"/"Następny tydzień" change the displayed date range and data.

- [ ] **Step 5: Commit**

```bash
git add app/frontend/src/App.tsx app/frontend/src/components/TimetableView.tsx
git commit -m "feat: add timetable view with week navigation"
```

---

## Task 11: Docker Compose wiring

**Files:**
- Create: `app/backend/Dockerfile`
- Create: `app/frontend/Dockerfile`
- Create: `app/frontend/nginx.conf`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: root `package.json`/`package-lock.json` (library deps, unmodified), `app/backend/package.json`, `app/frontend/package.json` from all prior tasks.
- Produces: `docker compose up` serving the frontend on `http://localhost:3000` and the backend on `http://localhost:3001`, frontend's `/api/*` proxied to the backend container.

- [ ] **Step 1: Update `.gitignore`**

Current content ignores all dotfiles (`.*`) except `.gitignore`/`.prettierrc`, which would also hide `.env.example`. Add an exception and ignore the frontend build output:

```gitignore
node_modules/
.*
!.gitignore
!.prettierrc
!.env.example
*.log
test.js
librus-api-*.tgz
dist/
```

- [ ] **Step 2: Create `.env.example`**

```
# Base64-encoded 32-byte key used to encrypt stored Librus account passwords.
# Generate with: openssl rand -base64 32
ACCOUNTS_ENC_KEY=
```

- [ ] **Step 3: Create `app/backend/Dockerfile`**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install the library's own runtime dependencies (used by lib/api.js)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY lib ./lib

# Install backend app dependencies (better-sqlite3 needs a C++ toolchain on alpine)
RUN apk add --no-cache python3 make g++
WORKDIR /app/app/backend
COPY app/backend/package.json app/backend/package-lock.json ./
RUN npm ci --omit=dev
COPY app/backend/src ./src

ENV PORT=3001
EXPOSE 3001
CMD ["node", "src/server.js"]
```

- [ ] **Step 4: Create `app/frontend/nginx.conf`**

```nginx
server {
  listen 80;

  location /api/ {
    proxy_pass http://backend:3001/api/;
  }

  location / {
    root /usr/share/nginx/html;
    try_files $uri /index.html;
  }
}
```

- [ ] **Step 5: Create `app/frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY app/frontend/package.json app/frontend/package-lock.json ./
RUN npm ci
COPY app/frontend ./
RUN npm run build

FROM nginx:alpine
COPY app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 6: Create `docker-compose.yml`**

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: app/backend/Dockerfile
    environment:
      - ACCOUNTS_ENC_KEY
      - DB_PATH=/data/accounts.db
    volumes:
      - data:/data
    ports:
      - "3001:3001"

  frontend:
    build:
      context: .
      dockerfile: app/frontend/Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  data:
```

- [ ] **Step 7: Generate a local key and smoke-test the stack**

Run:
```bash
cp .env.example .env
echo "ACCOUNTS_ENC_KEY=$(openssl rand -base64 32)" > .env
docker compose up --build
```
Expected: both services build and start; `docker compose ps` shows `backend` and `frontend` running.

- [ ] **Step 8: Verify backend health through the container**

Run: `curl http://localhost:3001/health`
Expected: `{"status":"ok"}`.

- [ ] **Step 9: Verify frontend serves and proxies to the backend**

Run: `curl -s http://localhost:3000/ | grep -o '<title>[^<]*'` then `curl -s http://localhost:3000/api/accounts`
Expected: title tag present; `/api/accounts` returns `[]` (proxied through nginx to the backend).

- [ ] **Step 10: Manual end-to-end verification in a browser**

Open `http://localhost:3000`, add a real Librus account, confirm it appears in the list, open it and confirm the current week's timetable renders, then go back and delete it.

- [ ] **Step 11: Stop the stack**

Run: `docker compose down`

- [ ] **Step 12: Commit**

```bash
git add app/backend/Dockerfile app/frontend/Dockerfile app/frontend/nginx.conf docker-compose.yml .env.example .gitignore
git commit -m "feat: add Dockerfiles and docker-compose wiring for backend and frontend"
```

---

## Self-Review Notes

- **Spec coverage:** account CRUD (Task 6), session re-login on expiry (Task 5/7), timetable endpoint with week defaults (Task 7, delegates default `from`/`to` to `Calendar.getTimetable`), encrypted-at-rest passwords with fail-fast startup (Tasks 2/4), accounts UI + timetable UI (Tasks 9/10), docker-compose services and volume (Task 11) — every spec section maps to a task.
- **Type consistency checked:** `Account`/`Timetable`/`TimetableLesson` types defined once in `api.ts` (Task 8) and reused verbatim in Tasks 9-10's component props; `createApp`'s `librusFactory` option introduced in Task 6 is consumed identically by Task 7's mount.
- **No placeholders:** every step ships literal file contents; no task references an undefined type or function name.

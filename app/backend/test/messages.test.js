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

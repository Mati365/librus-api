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

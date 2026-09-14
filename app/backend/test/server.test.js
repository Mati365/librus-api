"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createApp } = require("../src/server.js");

test("createApp throws when ACCOUNTS_ENC_KEY is not set", () => {
  delete process.env.ACCOUNTS_ENC_KEY;
  assert.throws(() => createApp({ dbPath: ":memory:" }), /ACCOUNTS_ENC_KEY/);
});

test("GET /health returns ok", async () => {
  process.env.ACCOUNTS_ENC_KEY = crypto.randomBytes(32).toString("base64");
  const app = createApp({ dbPath: ":memory:" });
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

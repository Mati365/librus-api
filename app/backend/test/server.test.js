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

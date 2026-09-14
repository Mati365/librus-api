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

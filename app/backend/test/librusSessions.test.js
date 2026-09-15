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

  await manager.withSession(1, async () => "warm-up");

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

test("withSession shares one in-flight login across concurrent calls for the same account", async () => {
  let authorizeCalls = 0;
  const client = {
    authorize: async () => {
      authorizeCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
    },
  };
  const manager = createSessionManager({
    accountsStore: stubAccountsStore({ id: 1, login: "u", password_encrypted: Buffer.from("x") }),
    decryptPassword: () => "plain-pass",
    librusFactory: () => client,
  });

  const [first, second] = await Promise.all([
    manager.withSession(1, async (c) => { assert.equal(c, client); return "first"; }),
    manager.withSession(1, async (c) => { assert.equal(c, client); return "second"; }),
  ]);

  assert.equal(first, "first");
  assert.equal(second, "second");
  assert.equal(authorizeCalls, 1);
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

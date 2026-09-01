"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const packageJson = require("../package.json");
const Inbox = require("../lib/resources/inbox.js");

test("form-data is declared as a direct runtime dependency", () => {
  assert.match(packageJson.dependencies["form-data"] || "", /^\^4\./);
});

test("_getClassId does not write debug output", async () => {
  const api = {
    _request: async () => ({
      html: () => "selectRecipients('rodzic', false, 0, 12345);",
    }),
  };
  const inbox = new Inbox(api);
  const calls = [];
  const original = console.log;
  console.log = (...args) => calls.push(args);
  try {
    assert.equal(await inbox._getClassId(), 12345);
  } finally {
    console.log = original;
  }
  assert.deepEqual(calls, []);
  const source = fs.readFileSync(
    path.join(__dirname, "..", "lib", "resources", "inbox.js"),
    "utf8"
  );
  assert.doesNotMatch(source, /console\.log/);
});

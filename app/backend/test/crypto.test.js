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

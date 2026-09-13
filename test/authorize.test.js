"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const Librus = require("../lib/api.js");

function response(status, location, cookies = [], data = "") {
  return {
    status,
    data,
    headers: {
      ...(location ? { location } : {}),
      ...(cookies.length ? { "set-cookie": cookies } : {}),
    },
  };
}

test("authorize preserves OAuth state and follows the current redirect chain", async () => {
  const client = new Librus();
  await client._callerReady;

  const gets = [];
  const posts = [];
  const queue = [
    response(
      302,
      "https://api.librus.pl/OAuth/Authorization?client_id=46&response_type=code&scope=mydata&state=test",
      ["oauth_state=test; Path=/; Secure; HttpOnly"]
    ),
    response(302, "https://api.librus.pl/OAuth/Authorization?client_id=46", [
      "DZIENNIKSID=api-session; Path=/; Secure; HttpOnly",
    ]),
    response(200),
    response(302, "/OAuth/Authorization/PerformLogin"),
    response(302, "/OAuth/Authorization/Grant"),
    response(302, "https://synergia.librus.pl/loguj/portalRodzina?code=test"),
    response(200, null, [
      "DZIENNIKSID=synergia-session; Path=/; Secure; HttpOnly",
    ]),
  ];

  client.caller = {
    async get(url, options) {
      gets.push({ url, options });
      assert.ok(queue.length, `unexpected GET ${url}`);
      return queue.shift();
    },
    async postForm(url, data, options) {
      posts.push({ url, data, options });
      return response(200, null, [], {
        status: "ok",
        goTo: "/OAuth/Authorization/2FA?token=test",
      });
    },
  };

  const cookies = await client.authorize("user", "secret");

  assert.equal(queue.length, 0);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].data.login, "user");
  assert.equal(posts[0].data.pass, "secret");
  assert.match(posts[0].options.headers.Cookie, /DZIENNIKSID=api-session/);
  assert.equal(gets[0].options.maxRedirects, 0);
  assert.match(gets[1].url, /state=test/);
  assert.equal(
    gets.at(-1).url,
    "https://synergia.librus.pl/loguj/portalRodzina?code=test"
  );
  assert.ok(cookies.some((cookie) => cookie.key === "DZIENNIKSID"));
});

test("authorization continuations reject non-Librus destinations", async () => {
  const client = new Librus();
  assert.throws(
    () =>
      client._safeAuthorizationContinuationUrl("https://example.com/callback"),
    /Unexpected Librus authorization continuation URL/
  );
});

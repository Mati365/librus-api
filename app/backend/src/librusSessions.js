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

"use strict";
const express = require("express");

function createAccountsRouter({ accountsStore, encryptPassword, sessionManager, librusFactory }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json(accountsStore.list());
  });

  router.post("/", async (req, res) => {
    const { label, login, password } = req.body || {};
    if (!label || !login || !password) {
      return res.status(400).json({ error: "label, login and password are required" });
    }

    const client = librusFactory();
    try {
      await client.authorize(login, password);
    } catch (error) {
      // Log only error.message — the raw error can carry the plaintext Librus password in error.config.data
      console.error("librus auth failed for account %s: %s", login, error.message);
      return res.status(401).json({ error: "Invalid Librus credentials" });
    }

    try {
      const id = accountsStore.insert(label, login, encryptPassword(password));
      res.status(201).json({ id, label, login });
    } catch (error) {
      console.error("failed to save account %s: %s", login, error.message);
      res.status(500).json({ error: "Failed to save account" });
    }
  });

  router.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    accountsStore.remove(id);
    sessionManager.forget(id);
    res.status(204).end();
  });

  return router;
}

module.exports = { createAccountsRouter };

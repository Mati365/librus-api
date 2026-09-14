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
    } catch {
      return res.status(401).json({ error: "Invalid Librus credentials" });
    }

    const id = accountsStore.insert(label, login, encryptPassword(password));
    res.status(201).json({ id, label, login });
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

"use strict";
const express = require("express");
const { getEncryptionKey } = require("./crypto.js");
const { createDb, makeAccountsStore } = require("./db.js");

function createApp({ dbPath = process.env.DB_PATH || "/data/accounts.db" } = {}) {
  getEncryptionKey();

  const db = createDb(dbPath);
  const accountsStore = makeAccountsStore(db);

  const app = express();
  app.use(express.json());
  app.locals.accountsStore = accountsStore;

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`Backend listening on port ${port}`));
}

module.exports = { createApp };

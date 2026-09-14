"use strict";
const express = require("express");
const { getEncryptionKey, encryptPassword, decryptPassword } = require("./crypto.js");
const { createDb, makeAccountsStore } = require("./db.js");
const { createSessionManager } = require("./librusSessions.js");
const { createAccountsRouter } = require("./routes/accounts.js");
const { createTimetableRouter } = require("./routes/timetable.js");

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

function createApp({
  dbPath = process.env.DB_PATH || "/data/accounts.db",
  librusFactory = () => new (require("../../../lib/api.js"))(),
} = {}) {
  getEncryptionKey();

  const db = createDb(dbPath);
  const accountsStore = makeAccountsStore(db);
  const sessionManager = createSessionManager({ accountsStore, decryptPassword, librusFactory });

  const app = express();
  app.use(express.json());
  app.locals.accountsStore = accountsStore;
  app.locals.sessionManager = sessionManager;

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    "/api/accounts",
    createAccountsRouter({ accountsStore, encryptPassword, sessionManager, librusFactory })
  );

  app.use("/api/accounts", createTimetableRouter({ sessionManager }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("Unhandled error in request handler:", err.message);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`Backend listening on port ${port}`));
}

module.exports = { createApp };

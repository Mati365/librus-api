"use strict";
const express = require("express");

function createApp() {
  const app = express();
  app.use(express.json());

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

"use strict";
const express = require("express");
const config = require("../../../../lib/config.js");

const RECEIVED = config.folder.RECEIVED;

function createMessagesRouter({ sessionManager }) {
  const router = express.Router();

  router.get("/:id/messages", async (req, res) => {
    const accountId = Number(req.params.id);

    try {
      const messages = await sessionManager.withSession(
        accountId,
        (client) => client.inbox.listInbox(RECEIVED),
        (result) => Array.isArray(result) && result.length === 0
      );
      res.json(messages);
    } catch (error) {
      // Log only error.message — the raw error can carry the plaintext Librus password in error.config.data
      console.error("librus inbox fetch failed for account %s: %s", req.params.id, error.message);
      res.status(502).json({ error: "Failed to fetch messages from Librus" });
    }
  });

  router.get("/:id/messages/:messageId", async (req, res) => {
    const accountId = Number(req.params.id);
    const messageId = Number(req.params.messageId);

    if (!Number.isInteger(messageId) || messageId <= 0) {
      return res.status(400).json({ error: "messageId must be a positive integer" });
    }

    try {
      const message = await sessionManager.withSession(
        accountId,
        (client) => client.inbox.getMessage(RECEIVED, messageId),
        (result) => !result
      );

      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Only plain-text content crosses this boundary: message.html is third-party
      // markup and rendering it in the browser would be an XSS vector.
      res.json({
        id: messageId,
        title: message.title,
        user: message.user,
        date: message.date,
        content: message.content,
      });
    } catch (error) {
      // Log only error.message — the raw error can carry the plaintext Librus password in error.config.data
      console.error("librus message fetch failed for account %s: %s", req.params.id, error.message);
      res.status(502).json({ error: "Failed to fetch message from Librus" });
    }
  });

  return router;
}

module.exports = { createMessagesRouter };

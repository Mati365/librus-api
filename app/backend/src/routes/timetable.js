"use strict";
const express = require("express");

function createTimetableRouter({ sessionManager }) {
  const router = express.Router();

  router.get("/:id/timetable", async (req, res) => {
    const accountId = Number(req.params.id);
    const { from, to } = req.query;

    try {
      const timetable = await sessionManager.withSession(
        accountId,
        (client) => client.calendar.getTimetable(from, to),
        (result) => Array.isArray(result?.hours) && result.hours.length === 0
      );
      res.json(timetable);
    } catch {
      res.status(502).json({ error: "Failed to fetch timetable from Librus" });
    }
  });

  return router;
}

module.exports = { createTimetableRouter };

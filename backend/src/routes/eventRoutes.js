const express = require("express");
const { getGroupsFromAI } = require("../services/aiService.js");

const router = express.Router();

router.post("/:id/match", async (req, res) => {
  try {
    const eventId = req.params.id;
    const { mode = "auto", preferences = {}, users } = req.body;

    const result = await getGroupsFromAI(eventId, mode, preferences, users);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("Error in /match:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;

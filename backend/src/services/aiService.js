const fetch = require("node-fetch");
require("dotenv").config();

const AI_URL = process.env.AI_URL;
const AI_TOKEN = process.env.AI_TOKEN;

async function getGroupsFromAI(eventId, mode, preferences, users) {
  const response = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_TOKEN}`,
    },
    body: JSON.stringify({
      event_id: eventId,
      mode,
      preferences,
      users,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI service error: ${response.status} - ${text}`);
  }

  return await response.json();
}

module.exports = { getGroupsFromAI };

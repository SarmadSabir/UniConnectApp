import express from "express";
import Event from "../models/Event.js";
import Waitlist from "../models/Waitlist.js";
import { requireAdmin } from "../middleware/auth.js";
import { normalizeEventId } from "../utils/eventIds.js";
import { processEventForMatching } from "../services/batchMatchingWorker.js";
import { harmonizeHardFilterState } from "../utils/hardFilterState.js";

const HARD_FILTER_PROMPT_MESSAGE =
  process.env.HARD_FILTER_PROMPT_MESSAGE ||
  "Still waiting for seniors. Want us to broaden your match to anyone?";

const YEAR_CLASSIFICATIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];

const hasPreferenceValue = (value) => {
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.length > 0;
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return !Number.isNaN(value);
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return Boolean(value);
};

const normalizePreferencesPayload = (prefs) => {
    if (!prefs || typeof prefs !== "object") return null;
    const clean = {};
    Object.entries(prefs).forEach(([key, value]) => {
        if (!hasPreferenceValue(value)) return;
        if (typeof value === "boolean") {
            if (value) clean[key] = true;
            return;
        }
        if (Array.isArray(value)) {
            let arr = value.map((entry) => {
                if (typeof entry === "string") return entry.trim();
                return entry;
            });
            if (key === "preferred_year_classifications") {
                arr = arr
                    .filter((entry) => typeof entry === "string" && YEAR_CLASSIFICATIONS.includes(entry))
                    .filter((entry, index, src) => src.indexOf(entry) === index);
            } else {
                arr = arr.filter((entry) => entry !== null && entry !== undefined && `${entry}`.trim().length > 0);
            }
            if (arr.length) clean[key] = arr;
            return;
        }
        clean[key] = value;
    });
  return Object.keys(clean).length ? clean : null;
};

const hasHardYearPreference = (entry) => {
  if (!entry?.preferences || typeof entry.preferences !== "object") return false;
  if (entry.hard_filter_relaxed) return false;
  const years = entry.preferences.preferred_year_classifications;
  return Array.isArray(years) && years.length > 0;
};

const buildHardFilterPromptPayload = (entry, eventKey) => {
  if (!entry || entry.hard_filter_prompt_state !== "pending") return null;
  const deferredMs = entry.hard_filter_deferred_at
    ? Date.now() - new Date(entry.hard_filter_deferred_at).getTime()
    : null;
  return {
    waitlistId: entry._id?.toString?.() ?? entry._id,
    eventId: eventKey,
    message: HARD_FILTER_PROMPT_MESSAGE,
    promptState: entry.hard_filter_prompt_state,
    deferredMinutes:
      deferredMs && Number.isFinite(deferredMs) ? Math.max(0, Math.floor(deferredMs / 60000)) : null,
    promptedAt: entry.hard_filter_prompted_at,
  };
};

const router = express.Router();

/**
 * LIST EVENTS + SEED DEFAULTS
 */
router.get("/", async (_req, res) => {
    try {
        let events = await Event.find().sort({ date: 1 }).lean();

        if (!events.length) {
            const seed = await Event.insertMany([
                {
                    title: "Campus Creator Lab",
                    description: "Rapid-fire ideation sprint to meet co-founders.",
                    date: new Date(),
                },
                {
                    title: "Innovation Hack Night",
                    description: "48-hour challenge for AI + research collabs.",
                    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            ]);
            events = seed.map((doc) => doc.toObject());
        }

        res.json({ success: true, events });
    } catch (err) {
        console.error("Event list error:", err);
        res.status(500).json({ success: false, error: "Unable to load events" });
    }
});

/**
 * CREATE EVENT
 */
router.post("/", requireAdmin, async (req, res) => {
    try {
        const { title, description, date } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, error: "title is required" });
        }

        const event = await Event.create({
            title,
            description: description || "",
            date: date ? new Date(date) : new Date(),
        });

        res.status(201).json({ success: true, event });
    } catch (err) {
        console.error("Event create error:", err);
        res.status(500).json({ success: false, error: "Unable to create event" });
    }
});

/**
 * JOIN EVENT → Add user to waitlist
 */
router.post("/:id/join", async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, preferences } = req.body;
        const eventKey = normalizeEventId(id);
        const normalizedPreferences = normalizePreferencesPayload(preferences);

        if (!user_id) {
            return res.status(400).json({ success: false, message: "user_id is required" });
        }

        const existing = await Waitlist.findOne({ event_id: eventKey, user_id });
        if (existing) {
            return res.json({
                success: true,
                alreadyQueued: true,
                message: "User already in waitlist"
            });
        }

        await Waitlist.create({
            event_id: eventKey,
            user_id,
            preferences: normalizedPreferences,
        });

        res.json({ success: true, queued: true, message: "User added to waitlist" });
    } catch (err) {
        console.error("Join error:", err);
        if (err.code === 11000) {
            return res.json({
                success: true,
                alreadyQueued: true,
                message: "User already in waitlist"
            });
        }
        res.status(500).json({ error: "Join failed" });
    }
});

/**
 * CHECK WAITLIST STATUS
 */
router.get("/:id/wait-status/:userId", async (req, res) => {
    try {
        const { id, userId } = req.params;
        const eventKey = normalizeEventId(id);
        const existing = await Waitlist.findOne({ event_id: eventKey, user_id: userId });
        if (existing) {
            const migration = harmonizeHardFilterState(existing);
            if (migration) {
                await Waitlist.updateOne({ _id: existing._id }, migration);
            }
        }
        const response = {
            success: true,
            waiting: Boolean(existing),
        };
        if (existing) {
            response.waitlistEntryId = existing._id;
            response.hardFilter = {
                hasHardPreference: hasHardYearPreference(existing),
                relaxed: Boolean(existing.hard_filter_relaxed),
                deferredSince: existing.hard_filter_deferred_at,
            };
            response.hardFilterPrompt = buildHardFilterPromptPayload(existing, eventKey);
        }
        res.json(response);
    } catch (err) {
        console.error("Status check error:", err);
        res.status(500).json({ success: false, error: "Unable to check waitlist status" });
    }
});

/**
 * HARD FILTER PROMPT ACTION
 */
router.post("/:id/waitlist/:userId/hard-filter-opt-in", async (req, res) => {
    try {
        const { id, userId } = req.params;
        const { action = "accept" } = req.body || {};
        const normalizedAction = `${action}`.toLowerCase();
        const eventKey = normalizeEventId(id);
        const entry = await Waitlist.findOne({ event_id: eventKey, user_id: userId });

        if (!entry) {
            return res.status(404).json({ success: false, error: "Waitlist entry not found" });
        }

        const migration = harmonizeHardFilterState(entry);
        if (migration) {
            await Waitlist.updateOne({ _id: entry._id }, migration);
        }

        const now = new Date();
        if (normalizedAction === "accept") {
            entry.hard_filter_relaxed = true;
            entry.hard_filter_relaxed_at = now;
            entry.hard_filter_prompt_state = "accepted";
            entry.hard_filter_prompted_at = now;
            await entry.save();
            return res.json({
                success: true,
                relaxed: true,
                hardFilterPrompt: null,
                hardFilter: {
                    hasHardPreference: hasHardYearPreference(entry),
                    relaxed: true,
                    deferredSince: entry.hard_filter_deferred_at,
                },
            });
        }

        if (normalizedAction === "decline") {
            entry.hard_filter_prompt_state = "declined";
            entry.hard_filter_prompted_at = now;
            await entry.save();
            return res.json({
                success: true,
                relaxed: Boolean(entry.hard_filter_relaxed),
                hardFilterPrompt: null,
                hardFilter: {
                    hasHardPreference: hasHardYearPreference(entry),
                    relaxed: Boolean(entry.hard_filter_relaxed),
                    deferredSince: entry.hard_filter_deferred_at,
                },
            });
        }

        return res.status(400).json({ success: false, error: "Unknown action" });
    } catch (err) {
        console.error("Hard-filter opt-in error:", err);
        res.status(500).json({ success: false, error: "Unable to update waitlist entry" });
    }
});

/**
 * RUN MATCHING → Create Groups + ChatRooms
 */
router.post("/:id/run-matching", async (req, res) => {
    try {
        const { id } = req.params;
        const forceProcess = Boolean(req.query?.force || req.body?.force);
        const result = await processEventForMatching(id, { forceProcess });

        if (!result.triggered) {
            return res.json({
                success: false,
                message: result.message || "No match created yet",
                queueSize: result.queueSize || 0,
            });
        }

        res.json({
            success: true,
            message: result.message || "Group formed successfully",
            groups: [
                {
                    group: result.group,
                    chatroom: result.chatroom,
                },
            ],
        });

    } catch (err) {
        console.error("Matcher error:", err);
        res.status(500).json({ error: "Matcher failed" });
    }
});

export default router;


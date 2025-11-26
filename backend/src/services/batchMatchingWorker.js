import mongoose from "mongoose";
import Waitlist from "../models/Waitlist.js";
import Group from "../models/Group.js";
import ChatRoom from "../models/ChatRoom.js";
import { getGroupsFromAI } from "./aiService.js";
import { normalizeEventId } from "../utils/eventIds.js";

const MIN_TRIPLET_SIZE = 3;
const DEFAULT_TRIGGER_SIZE = Number(process.env.MATCH_TRIGGER_BATCH_SIZE || 6);
const DEFAULT_MAX_WAIT_MS = Number(process.env.MATCH_MAX_WAIT_MS || 30000);
const DEFAULT_POLL_INTERVAL_MS = Number(process.env.MATCH_POLL_INTERVAL_MS || 5000);

const processingEvents = new Set();

const toObjectId = (value) => {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(value);
  } catch (err) {
    return null;
  }
};

const selectBestTriplet = (groups = []) => {
  return groups
    .filter((g) => Array.isArray(g.members) && g.members.length === 3)
    .reduce((best, current) => {
      const currentScore =
        typeof current.score === "number" ? current.score : Number.NEGATIVE_INFINITY;
      const bestScore = typeof best?.score === "number" ? best.score : Number.NEGATIVE_INFINITY;
      return currentScore > bestScore ? current : best;
    }, null);
};

const shouldTrigger = (queue, { triggerSize, maxWaitMs, forceProcess }) => {
  if (queue.length < MIN_TRIPLET_SIZE) {
    return { shouldRun: false, reason: "Need at least 3 users" };
  }
  if (forceProcess) {
    return { shouldRun: true, reason: "Manual trigger" };
  }
  if (queue.length >= triggerSize) {
    return { shouldRun: true, reason: `Batch size reached (${queue.length})` };
  }
  const oldest = queue[0];
  const waitedMs = oldest ? Date.now() - new Date(oldest.joined_at).getTime() : 0;
  if (waitedMs >= maxWaitMs) {
    return { shouldRun: true, reason: `Oldest waited ${Math.round(waitedMs / 1000)}s` };
  }
  return { shouldRun: false, reason: "Still collecting users for quality match" };
};

const mergePreferenceArrays = (existing = [], incoming = []) => {
  const merged = new Set(existing);
  incoming.forEach((value) => {
    if (value === null || value === undefined) return;
    const normalized = typeof value === "string" ? value.trim() : value;
    if (normalized === "" || normalized === undefined || normalized === null) return;
    merged.add(normalized);
  });
  return [...merged];
};

const aggregatePreferencesForQueue = (queue) => {
  const merged = {};
  let hasAny = false;
  queue.forEach((entry) => {
    const prefs = entry.preferences;
    if (!prefs || typeof prefs !== "object") return;
    Object.entries(prefs).forEach(([key, value]) => {
      if (typeof value === "boolean") {
        if (value) {
          merged[key] = true;
          hasAny = true;
        }
        return;
      }
      if (Array.isArray(value)) {
        if (!value.length) return;
        merged[key] = mergePreferenceArrays(merged[key], value);
        if (merged[key].length) {
          hasAny = true;
        }
        return;
      }
      if (value === null || value === undefined) return;
      merged[key] = value;
      hasAny = true;
    });
  });
  return hasAny ? merged : null;
};

const buildAiPayload = (queue) =>
  queue.map((entry) => {
    const profile = entry.user_id;
    return {
      user_id: profile._id.toString(),
      age: profile.age,
      year_classification: profile.year_classification,
      school: profile.school,
      program: profile.program,
      major: profile.major,
      gender: profile.gender,
      interests: Array.isArray(profile.interests) ? profile.interests : [],
    };
  });

const acquireLock = (eventKey) => {
  if (processingEvents.has(eventKey)) {
    return false;
  }
  processingEvents.add(eventKey);
  return true;
};

const releaseLock = (eventKey) => {
  processingEvents.delete(eventKey);
};

export async function processEventForMatching(rawEventId, options = {}) {
  const eventIdNormalized = normalizeEventId(rawEventId);
  const eventIdLabel =
    typeof eventIdNormalized?.toString === "function"
      ? eventIdNormalized.toString()
      : (rawEventId ?? "").toString();
  const lockKey = eventIdLabel || JSON.stringify(rawEventId || {});

  if (!eventIdNormalized && !eventIdLabel) {
    return { triggered: false, message: "Invalid event id" };
  }

  if (mongoose.connection.readyState !== 1) {
    return { triggered: false, message: "Database not connected yet" };
  }

  if (!acquireLock(lockKey)) {
    return { triggered: false, message: "Event already processing" };
  }

  const triggerSize = Number(options.triggerSize || DEFAULT_TRIGGER_SIZE);
  const maxWaitMs = Number(options.maxWaitMs || DEFAULT_MAX_WAIT_MS);

  try {
    const waitlist = await Waitlist.find({ event_id: eventIdNormalized })
      .sort({ joined_at: 1 })
      .populate("user_id");
    const missing = waitlist.filter((entry) => !entry.user_id);
    if (missing.length) {
      await Waitlist.deleteMany({ _id: { $in: missing.map((entry) => entry._id) } });
    }
    const queue = waitlist.filter((entry) => entry.user_id);

    if (!queue.length) {
      return { triggered: false, message: "No users waiting", queueSize: 0 };
    }

    const trigger = shouldTrigger(queue, {
      triggerSize,
      maxWaitMs,
      forceProcess: Boolean(options.forceProcess),
    });

    if (!trigger.shouldRun) {
      return {
        triggered: false,
        message: trigger.reason,
        queueSize: queue.length,
        eventId: eventIdLabel,
      };
    }

    const aiUsers = buildAiPayload(queue);
    const aggregatedPreferences = aggregatePreferencesForQueue(queue);
    const mode = aggregatedPreferences ? "preference" : "auto";
    const aiResponse = await getGroupsFromAI(
      eventIdLabel,
      mode,
      aggregatedPreferences || null,
      aiUsers
    );
    const bestTriplet = selectBestTriplet(aiResponse?.groups || []);

    if (!bestTriplet) {
      return {
        triggered: false,
        message: "AI did not return a valid triplet",
        queueSize: queue.length,
        eventId: eventIdLabel,
      };
    }

    const memberIds = bestTriplet.members.map((id) => id.toString());
    const membersInQueue = queue.filter((entry) => memberIds.includes(entry.user_id._id.toString()));
    if (membersInQueue.length !== MIN_TRIPLET_SIZE) {
      return {
        triggered: false,
        message: "Triplet references users no longer waiting",
        queueSize: queue.length,
        eventId: eventIdLabel,
      };
    }

    const objectIds = memberIds.map((id) => toObjectId(id)).filter(Boolean);
    if (objectIds.length !== MIN_TRIPLET_SIZE) {
      return {
        triggered: false,
        message: "Failed to convert member ids",
        queueSize: queue.length,
        eventId: eventIdLabel,
      };
    }

    const groupDoc = await Group.create({
      event_id: eventIdLabel,
      members: objectIds,
      score: typeof bestTriplet.score === "number" ? bestTriplet.score : null,
      reasons: Array.isArray(bestTriplet.reasons) ? bestTriplet.reasons : [],
    });

    const chatroom = await ChatRoom.create({
      group_id: groupDoc._id,
      messages: [],
    });

    await groupDoc.populate({
      path: "members",
      select: "name university_email",
    });

    await Waitlist.deleteMany({
      event_id: eventIdNormalized,
      user_id: { $in: objectIds },
    });

    return {
      triggered: true,
      message: trigger.reason,
      eventId: eventIdLabel,
      queueSize: queue.length,
      score: groupDoc.score,
      group: groupDoc,
      chatroom,
    };
  } catch (err) {
    console.error("[batch-matcher] Failed to process event queue", err);
    return {
      triggered: false,
      message: "Matcher failure",
      error: err.message,
      eventId: eventIdLabel,
    };
  } finally {
    releaseLock(lockKey);
  }
}

export function startBatchMatchingWorker(logger = console) {
  const intervalMs = Number(DEFAULT_POLL_INTERVAL_MS);
  if (!intervalMs || intervalMs <= 0) {
    logger.warn?.("[batch-matcher] Poll interval disabled; worker not started");
    return () => {};
  }

  let dbReady = mongoose.connection.readyState === 1;

  const timer = setInterval(async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        if (dbReady) {
          logger.warn?.("[batch-matcher] MongoDB disconnected, pausing worker");
          dbReady = false;
        }
        return;
      }
      if (!dbReady) {
        logger.info?.("[batch-matcher] MongoDB reconnected, resuming worker");
        dbReady = true;
      }
      const eventIds = await Waitlist.distinct("event_id");
      for (const eventId of eventIds) {
        const result = await processEventForMatching(eventId);
        if (result?.triggered) {
          logger.info?.(
            `[batch-matcher] Created group for event ${result.eventId} (score: ${
              typeof result.score === "number" ? result.score.toFixed(3) : "n/a"
            })`
          );
        }
      }
    } catch (err) {
      logger.error?.("[batch-matcher] Background worker error", err);
    }
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return () => clearInterval(timer);
}

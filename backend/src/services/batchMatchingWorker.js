import mongoose from "mongoose";
import Waitlist from "../models/Waitlist.js";
import Group from "../models/Group.js";
import ChatRoom from "../models/ChatRoom.js";
import { getGroupsFromAI } from "./aiService.js";
import { normalizeEventId } from "../utils/eventIds.js";

const MIN_TRIPLET_SIZE = 3;
const DEFAULT_TRIGGER_SIZE = Number(process.env.MATCH_TRIGGER_BATCH_SIZE || 6);
const DEFAULT_MAX_WAIT_MS = Number(process.env.MATCH_MAX_WAIT_MS || 60000);
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

const HARD_PREF_KEYS = ["preferred_year_classifications"];
const SOFT_PREF_KEYS = [
  "want_same_interests",
  "want_different_major",
  "want_same_major",
  "want_same_gender",
];

const normalizeArrayPreference = (value = []) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : entry))
    .filter((entry) => entry !== null && entry !== undefined && entry !== "");
};

const buildPreferenceMeta = (prefs = {}) => {
  if (!prefs || typeof prefs !== "object") {
    return {
      hard: { has: false, years: [] },
      soft: { has: false },
    };
  }
  const hardYears = normalizeArrayPreference(prefs.preferred_year_classifications);
  const hasSoft = SOFT_PREF_KEYS.some((key) => Boolean(prefs[key]));
  return {
    hard: {
      has: hardYears.length > 0,
      years: hardYears,
    },
    soft: {
      has: hasSoft,
    },
  };
};

const meetsHardPreferences = (entryMeta, candidateProfile) => {
  if (!entryMeta?.hard?.has) return true;
  if (!candidateProfile) return false;
  const candidateYear = candidateProfile.year_classification;
  if (!candidateYear) return false;
  return entryMeta.hard.years.includes(candidateYear);
};

const partitionEligibleQueue = (queue) => {
  if (!queue.length) {
    return { eligible: [], deferred: [] };
  }
  const deferredIds = new Set();
  let changed = true;

  const getCandidateSet = (entry) =>
    queue.filter(
      (candidate) =>
        candidate !== entry &&
        !deferredIds.has(candidate._id.toString()) &&
        candidate.user_id &&
        meetsHardPreferences(entry.preferenceMeta, candidate.user_id)
    );

  while (changed) {
    changed = false;
    queue.forEach((entry) => {
      if (deferredIds.has(entry._id.toString())) return;
      if (!entry.preferenceMeta?.hard?.has) return;
      const compatible = getCandidateSet(entry);
      if (compatible.length < MIN_TRIPLET_SIZE - 1) {
        deferredIds.add(entry._id.toString());
        changed = true;
      }
    });
  }

  const eligible = queue.filter((entry) => !deferredIds.has(entry._id.toString()));
  const deferred = queue.filter((entry) => deferredIds.has(entry._id.toString()));
  return { eligible, deferred };
};

const summarizePreferences = (queue) => {
  let hasHard = false;
  let hasSoft = false;
  queue.forEach((entry) => {
    if (entry.preferenceMeta?.hard?.has) {
      hasHard = true;
    }
    if (entry.preferenceMeta?.soft?.has) {
      hasSoft = true;
    }
  });
  const mode = hasHard || hasSoft ? "preference" : "auto";
  return {
    mode,
    summary: {
      version: 2,
      has_hard: hasHard,
      has_soft: hasSoft,
    },
  };
};

const selectBestTriplet = (groups = [], entryLookup) => {
  let best = null;
  groups.forEach((group) => {
    if (!Array.isArray(group.members) || group.members.length !== MIN_TRIPLET_SIZE) return;
    const respectsConstraints = group.members.every((memberId, index) => {
      const entry = entryLookup.get(memberId.toString());
      if (!entry) return false;
      const partners = group.members
        .filter((_, idx) => idx !== index)
        .map((partnerId) => entryLookup.get(partnerId.toString()))
        .filter(Boolean);
      if (partners.length !== MIN_TRIPLET_SIZE - 1) return false;
      return partners.every((partner) =>
        meetsHardPreferences(entry.preferenceMeta, partner.user_id)
      );
    });
    if (!respectsConstraints) return;
    const score = typeof group.score === "number" ? group.score : Number.NEGATIVE_INFINITY;
    if (!best || score > (typeof best.score === "number" ? best.score : Number.NEGATIVE_INFINITY)) {
      best = group;
    }
  });
  return best;
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
      preferences: entry.preferences || null,
      joined_at: entry.joined_at,
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
    queue.forEach((entry) => {
      entry.preferenceMeta = buildPreferenceMeta(entry.preferences);
    });

    if (!queue.length) {
      return { triggered: false, message: "No users waiting", queueSize: 0 };
    }

    const { eligible: eligibleQueue } = partitionEligibleQueue(queue);

    if (!eligibleQueue.length) {
      return {
        triggered: false,
        message: "Waiting for compatible matches",
        queueSize: queue.length,
        eligibleSize: 0,
        eventId: eventIdLabel,
      };
    }

    const trigger = shouldTrigger(eligibleQueue, {
      triggerSize,
      maxWaitMs,
      forceProcess: Boolean(options.forceProcess),
    });

    if (!trigger.shouldRun) {
      return {
        triggered: false,
        message: trigger.reason,
        queueSize: queue.length,
        eligibleSize: eligibleQueue.length,
        eventId: eventIdLabel,
      };
    }

    const aiUsers = buildAiPayload(eligibleQueue);
    const preferenceSummary = summarizePreferences(eligibleQueue);
    const entryLookup = new Map();
    eligibleQueue.forEach((entry) => {
      entryLookup.set(entry.user_id._id.toString(), entry);
    });

    const aiResponse = await getGroupsFromAI(
      eventIdLabel,
      preferenceSummary.mode,
      preferenceSummary.summary,
      aiUsers
    );
    const bestTriplet = selectBestTriplet(aiResponse?.groups || [], entryLookup);

    if (!bestTriplet) {
      return {
        triggered: false,
        message: "AI did not return a valid triplet",
        queueSize: queue.length,
        eligibleSize: eligibleQueue.length,
        eventId: eventIdLabel,
      };
    }

    const memberIds = bestTriplet.members.map((id) => id.toString());
    const membersInQueue = eligibleQueue.filter((entry) =>
      memberIds.includes(entry.user_id._id.toString())
    );
    if (membersInQueue.length !== MIN_TRIPLET_SIZE) {
      return {
        triggered: false,
        message: "Triplet references users no longer waiting",
        queueSize: queue.length,
        eligibleSize: eligibleQueue.length,
        eventId: eventIdLabel,
      };
    }

    const objectIds = memberIds.map((id) => toObjectId(id)).filter(Boolean);
    if (objectIds.length !== MIN_TRIPLET_SIZE) {
      return {
        triggered: false,
        message: "Failed to convert member ids",
        queueSize: queue.length,
        eligibleSize: eligibleQueue.length,
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
      eligibleSize: eligibleQueue.length,
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

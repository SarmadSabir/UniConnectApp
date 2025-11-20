import express from "express";
import Event from "../models/Event.js";
import EventQueue from "../models/EventQueue.js";
import User from "../models/User.js";
import Group from "../models/Group.js";
import ChatRoom from "../models/ChatRoom.js";
import { getGroupsFromAI } from "../services/aiService.js";

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
router.post("/", async (req, res) => {
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

        if (!user_id) {
            return res.status(400).json({ success: false, message: "user_id is required" });
        }

        const existing = await EventQueue.findOne({ event_id: id, user_id });
        if (existing) {
            return res.json({
                success: true,
                alreadyQueued: true,
                message: "User already in waitlist"
            });
        }

        await EventQueue.create({
            event_id: id,
            user_id,
            preferences,
            status: "waiting"
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
        const existing = await EventQueue.findOne({ event_id: id, user_id: userId, status: "waiting" });
        res.json({ success: true, waiting: Boolean(existing) });
    } catch (err) {
        console.error("Status check error:", err);
        res.status(500).json({ success: false, error: "Unable to check waitlist status" });
    }
});

/**
 * RUN MATCHING → Create Groups + ChatRooms
 */
router.post("/:id/run-matching", async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch waitlisted users
        const queue = await EventQueue.find({ event_id: id, status: "waiting" })
            .populate("user_id");

        if (queue.length < 3) {
            return res.json({
                success: false,
                message: "Not enough users yet"
            });
        }

        // 2. Convert users → AI format
        const usersForAI = queue.map(q => ({
            user_id: q.user_id._id.toString(),
            age: q.user_id.age,
            year_classification: q.user_id.year_classification,
            school: q.user_id.school,
            program: q.user_id.program,
            major: q.user_id.major,
            gender: q.user_id.gender,
            interests: q.user_id.interests,
        }));

        // 3. Get AI groups
        const aiResponse = await getGroupsFromAI(id, "auto", {}, usersForAI);
        const { groups } = aiResponse;

        if (!groups || groups.length === 0) {
            return res.json({ success: false, message: "AI returned no groups" });
        }

        // 4. Create Group + ChatRoom for each result
        const output = [];

        for (let g of groups) {
            // Create Group in DB
            const groupDoc = await Group.create({
                event_id: id,
                members: g.members,
                score: g.score || null,
                reasons: g.reasons || []
            });

            // Create ChatRoom in DB
            const chatroom = await ChatRoom.create({
                group_id: groupDoc._id,
                messages: []
            });

            await groupDoc.populate({
                path: "members",
                select: "name university_email"
            });

            output.push({
                group: groupDoc,
                chatroom: chatroom
            });
        }

        // 5. Remove matched from waitlist
        const matched = groups.flatMap(g => g.members);
        await EventQueue.deleteMany({
            event_id: id,
            user_id: { $in: matched }
        });

        res.json({
            success: true,
            message: "Groups formed successfully",
            groups: output
        });

    } catch (err) {
        console.error("Matcher error:", err);
        res.status(500).json({ error: "Matcher failed" });
    }
});

export default router;

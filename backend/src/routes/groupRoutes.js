import express from "express";
import Group from "../models/Group.js";
import ChatRoom from "../models/ChatRoom.js";

const router = express.Router();

router.get("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ success: false, error: "userId required" });
        }

        const groups = await Group.find({ members: userId })
            .populate({
                path: "members",
                select: "name university_email"
            })
            .sort({ created_at: -1 })
            .lean();

        if (!groups.length) {
            return res.json({ success: true, groups: [] });
        }

        const chatrooms = await ChatRoom.find({
            group_id: { $in: groups.map((g) => g._id) }
        }).lean();

        const chatMap = chatrooms.reduce((acc, room) => {
            acc[room.group_id.toString()] = room;
            return acc;
        }, {});

        const payload = groups.map((group) => ({
            group,
            chatroom: chatMap[group._id.toString()] || null
        }));

        res.json({ success: true, groups: payload });
    } catch (err) {
        console.error("Group fetch error:", err);
        res.status(500).json({ success: false, error: "Failed to load groups" });
    }
});

export default router;

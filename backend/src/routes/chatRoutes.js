import express from "express";
import mongoose from "mongoose";
import ChatRoom from "../models/ChatRoom.js";

const router = express.Router();

const populateMessages = {
  path: "messages.sender",
  select: "name",
};

router.get("/:chatroomId", async (req, res) => {
  try {
    const { chatroomId } = req.params;

    const chat = await ChatRoom.findById(chatroomId).populate(populateMessages);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    res.json({ success: true, chat });
  } catch (err) {
    console.error("Chat fetch failed:", err);
    res.status(500).json({ success: false, error: "Failed to load chat" });
  }
});

router.post("/:chatroomId/message", async (req, res) => {
  try {
    const { chatroomId } = req.params;
    const { sender, text } = req.body;

    const chat = await ChatRoom.findById(chatroomId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: "Message text required" });
    }

    const normalizedSender =
      typeof sender === "string" && mongoose.Types.ObjectId.isValid(sender)
        ? new mongoose.Types.ObjectId(sender)
        : sender;

    chat.messages.push({ sender: normalizedSender, text: text.trim() });
    await chat.save();

    const populatedChat = await ChatRoom.findById(chatroomId).populate(populateMessages);
    res.json({ success: true, chat: populatedChat });
  } catch (err) {
    console.error("Message send failed:", err);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
});

export default router;

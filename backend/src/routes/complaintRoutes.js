import express from "express";
import Complaint from "../models/Complaint.js";
import User from "../models/User.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      reportedUserEmail,
      reason,
      requestType,
      messageText,
      reportedUserName,
    } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required" });
    }

    let reportedUser = null;
    let resolvedEmail = reportedUserEmail?.trim().toLowerCase() || "";
    if (resolvedEmail) {
      reportedUser = await User.findOne({
        university_email: resolvedEmail,
      });
    }

    const complaint = await Complaint.create({
      requester: req.user._id,
      reported_user: reportedUser?._id,
      reported_email: resolvedEmail,
      reported_name: reportedUser?.name || reportedUserName || "",
      reason: reason.trim(),
      message_text: messageText?.trim() || "",
      type: requestType === "ban" || requestType === "delete" ? requestType : "general",
    });

    res.status(201).json({ success: true, complaint });
  } catch (err) {
    console.error("Complaint submit error", err);
    res.status(500).json({ success: false, error: "Failed to submit complaint" });
  }
});

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate("requester", "name university_email")
      .populate("reported_user", "name university_email")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, complaints });
  } catch (err) {
    console.error("Complaint list error", err);
    res.status(500).json({ success: false, error: "Failed to load complaints" });
  }
});

router.patch("/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["open", "in_review", "resolved", "rejected"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate("requester", "name university_email")
      .populate("reported_user", "name university_email");

    if (!complaint) {
      return res.status(404).json({ success: false, error: "Complaint not found" });
    }

    res.json({ success: true, complaint });
  } catch (err) {
    console.error("Complaint status update error", err);
    res.status(500).json({ success: false, error: "Failed to update complaint" });
  }
});

export default router;

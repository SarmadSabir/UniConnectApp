import express from "express";
import { requireAdmin } from "../middleware/auth.js";
import User from "../models/User.js";
import Waitlist from "../models/Waitlist.js";
import Group from "../models/Group.js";
import Complaint from "../models/Complaint.js";

const router = express.Router();

router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    await Waitlist.deleteMany({ user_id: user._id });
    await Group.updateMany({ members: user._id }, { $pull: { members: user._id } });
    await Complaint.updateMany(
      { reported_user: user._id },
      { status: "resolved", notes: "User removed by admin" }
    );

    await User.deleteOne({ _id: user._id });

    res.json({
      success: true,
      message: `User ${user.name || user._id} deleted`,
    });
  } catch (err) {
    console.error("Admin delete user error", err);
    res.status(500).json({ success: false, error: "Failed to delete user" });
  }
});

export default router;

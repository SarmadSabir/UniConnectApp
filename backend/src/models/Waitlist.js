import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  joined_at: { type: Date, default: Date.now },
});

export default mongoose.model("Waitlist", waitlistSchema);

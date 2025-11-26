import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema({
  // event_id might be a Mongo ObjectId or a slug string, so allow mixed type
  event_id: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  preferences: { type: Object, default: null },
  joined_at: { type: Date, default: Date.now, index: true },
});

waitlistSchema.index({ event_id: 1, user_id: 1 }, { unique: true });

export default mongoose.model("Waitlist", waitlistSchema);

import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema({
  // event_id might be a Mongo ObjectId or a slug string, so allow mixed type
  event_id: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  preferences: { type: Object, default: null },
  joined_at: { type: Date, default: Date.now, index: true },
  hard_filter_relaxed: { type: Boolean, default: false },
  hard_filter_relaxed_at: { type: Date, default: null },
  hard_filter_deferred_at: { type: Date, default: null },
  hard_filter_prompt_state: {
    type: String,
    enum: ["pending", "accepted", "declined"],
    default: null,
  },
  hard_filter_prompted_at: { type: Date, default: null },
});

waitlistSchema.index({ event_id: 1, user_id: 1 }, { unique: true });

export default mongoose.model("Waitlist", waitlistSchema);

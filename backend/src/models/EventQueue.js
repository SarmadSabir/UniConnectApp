import mongoose from "mongoose";

const eventQueueSchema = new mongoose.Schema({
    event_id: { type: String, required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    preferences: { type: Object, default: null },
    status: { type: String, default: "waiting" },  // waiting or matched
    created_at: { type: Date, default: Date.now }
});

eventQueueSchema.index({ event_id: 1, user_id: 1 }, { unique: true });

export default mongoose.model("EventQueue", eventQueueSchema);

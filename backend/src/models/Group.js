import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
    event_id: String,
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    score: Number,
    reasons: [String],
    created_at: { type: Date, default: Date.now }
});

export default mongoose.model("Group", groupSchema);

import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reported_user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reported_email: { type: String, default: "" },
    reported_name: { type: String, default: "" },
    reason: { type: String, required: true },
    message_text: { type: String, default: "" },
    type: {
      type: String,
      enum: ["ban", "delete", "general"],
      default: "general",
    },
    status: {
      type: String,
      enum: ["open", "in_review", "resolved", "rejected"],
      default: "open",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Complaint", complaintSchema);

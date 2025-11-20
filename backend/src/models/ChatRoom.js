import mongoose from "mongoose";

const chatRoomSchema = new mongoose.Schema({
    group_id: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
    messages: [
        {
            sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            text: String,
            timestamp: { type: Date, default: Date.now }
        }
    ]
});

export default mongoose.model("ChatRoom", chatRoomSchema);

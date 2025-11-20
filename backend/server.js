import express from "express";
import axios from "axios";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

import authRoutes from "./src/routes/auth.js";
import eventRoutes from "./src/routes/eventRoutes.js";
import chatRoutes from "./src/routes/chatRoutes.js";
import groupRoutes from "./src/routes/groupRoutes.js";

const app = express();
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/groups", groupRoutes);

// ----------------------
// MONGODB CONNECTION
// ----------------------
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("DB Error:", err));


// ----------------------
// AI MATCH ENDPOINT
// ----------------------
const AI_URL = "http://127.0.0.1:8000/match/cluster-triplets";
const TOKEN = "dev-secret";

app.post("/api/events/:id/match", async (req, res) => {
  try {
    const { id } = req.params;
    const { mode, preferences, users } = req.body;

    const aiResponse = await axios.post(
      AI_URL,
      { event_id: id, mode, preferences, users },
      { headers: { Authorization: `Bearer ${TOKEN}` }}
    );

    res.json(aiResponse.data);
  } catch (error) {
    console.error("AI match error: ", error.message);
    res.status(500).json({ error: "Failed to get AI match." });
  }
});


app.listen(4000, "0.0.0.0", () => {
  console.log("Backend running on 0.0.0.0:4000");
});

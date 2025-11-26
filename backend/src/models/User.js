import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    university_email: { type: String, unique: true, required: true },
    password_hash: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    year_classification: {
      type: String,
      enum: ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"],
    },
    school: String,
    program: String,
    major: String,
    interests: [String],
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);

import mongoose from "mongoose";

export const normalizeEventId = (value) => {
  if (!value) return value;

  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (typeof value === "object") {
    if (value._id && value._id !== value) {
      return normalizeEventId(value._id);
    }
    if (value.$oid) {
      return normalizeEventId(value.$oid);
    }
  }

  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }

  return typeof value === "string" ? value.trim() : value;
};

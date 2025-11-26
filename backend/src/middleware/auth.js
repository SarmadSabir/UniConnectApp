import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { getJwtSecret } from "../utils/jwt.js";

const resolveUserFromRequest = async (req) => {
  const header = req.headers.authorization || req.headers["Authorization"];
  let token = "";
  if (header && header.startsWith("Bearer ")) {
    token = header.replace("Bearer ", "").trim();
  } else if (req.headers["x-auth-token"]) {
    token = req.headers["x-auth-token"];
  }

  if (!token) {
    const err = new Error("Auth token missing");
    err.status = 401;
    throw err;
  }

  const payload = jwt.verify(token, getJwtSecret());
  const user = await User.findById(payload.id);
  if (!user) {
    const err = new Error("User not found");
    err.status = 401;
    throw err;
  }
  return user;
};

export const requireAuth = async (req, res, next) => {
  try {
    const user = await resolveUserFromRequest(req);
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error", err.message);
    res.status(err.status || 401).json({ success: false, error: err.message });
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (user.role !== "admin") {
      return res.status(403).json({ success: false, error: "Admin privileges required" });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("Admin auth error", err.message);
    res.status(err.status || 401).json({ success: false, error: err.message });
  }
};

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = "supersecret";

router.post("/signup", async (req, res) => {
    try {
        const {
            name,
            university_email,
            password,
            age,
            gender,
            year_classification,
            school,
            program,
            major,
            interests
        } = req.body || {};

        const cleanedName = (name || "").trim();
        const cleanedEmail = (university_email || "").trim().toLowerCase();
        const normalizedGender = (gender || "").trim();
        const normalizedYear = (year_classification || "").trim();
        const cleanedSchool = typeof school === "string" ? school.trim() : "";
        const cleanedProgram = typeof program === "string" ? program.trim() : "";
        const cleanedMajor = typeof major === "string" ? major.trim() : "";

        const allowedGenders = ["Male", "Female", "Other"];
        const allowedYears = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];

        if (!cleanedName || !cleanedEmail || !password || age === undefined || age === null || !normalizedGender || !normalizedYear) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        if (!allowedGenders.includes(normalizedGender)) {
            return res.status(400).json({ error: "Invalid gender selection" });
        }

        if (!allowedYears.includes(normalizedYear)) {
            return res.status(400).json({ error: "Invalid year classification" });
        }

        const ageNumber = Number(age);
        if (Number.isNaN(ageNumber) || ageNumber <= 0) {
            return res.status(400).json({ error: "Invalid age" });
        }

        const cleanedInterests = Array.isArray(interests)
            ? interests
                .map((i) => (typeof i === "string" ? i.trim() : ""))
                .filter(Boolean)
                .slice(0, 10)
            : [];

        const overwriteExisting = (req.query?.overwrite || "").toString() === "true";

        const existing = await User.findOne({ university_email: cleanedEmail });
        if (existing) {
            if (!overwriteExisting) {
                return res.status(400).json({ error: "User already exists" });
            }
            await User.deleteOne({ _id: existing._id });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const user = await User.create({
            name: cleanedName,
            university_email: cleanedEmail,
            password_hash,
            age: ageNumber,
            gender: normalizedGender,
            year_classification: normalizedYear,
            school: cleanedSchool,
            program: cleanedProgram,
            major: cleanedMajor,
            interests: cleanedInterests
        });

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

        res.json({ token, user });
    } catch (err) {
        console.error("Signup error", err);
        if (err.code === 11000) {
            return res.status(400).json({ error: "User already exists" });
        }
        if (err.name === "ValidationError") {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: "Internal signup error" });
    }
});


router.post("/login", async (req, res) => {
    try {
        const { university_email, password } = req.body;

        const user = await User.findOne({ university_email });
        if (!user) {
            return res.status(400).json({ error: "User does not exist" });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(400).json({ error: "Invalid password" });
        }

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

        res.json({ token, user });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed!" });
    }
});

export default router;

import axios from "axios";

const API_URL = "http://localhost:4000/api";

export async function requestMatch(eventId, mode, preferences, users) {
    try {
        const res = await axios.post(`${API_URL}/events/${eventId}/match`, {
            mode,
            preferences,
            users
        });
        return res.data;
    } catch (err) {
        console.error("Match request failed: ", err);
        throw err;
    }
}
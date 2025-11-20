import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Your laptop's Wi-Fi IPv4 address
const API_URL = "http://192.168.0.104:4000";

// ----------------------
// AUTH
// ----------------------
export async function signup(userData) {
    const res = await axios.post(`${API_URL}/api/auth/signup?overwrite=true`, userData);
    await AsyncStorage.setItem("token", res.data.token);
    await AsyncStorage.setItem("userId", res.data.user._id);
    await AsyncStorage.setItem("userName", res.data.user.name || "");
    return res.data.user;
}

export async function login(credentials) {
    const res = await axios.post(`${API_URL}/api/auth/login`, credentials);
    await AsyncStorage.setItem("token", res.data.token);
    await AsyncStorage.setItem("userId", res.data.user._id);
    await AsyncStorage.setItem("userName", res.data.user.name || "");
    return res.data.user;
}


export async function logout() {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("userId");
    await AsyncStorage.removeItem("userName");
}

export async function joinEvent(eventId, userId) {
  const res = await axios.post(`${API_URL}/api/events/${eventId}/join`, { user_id: userId });
  return res.data;
}

export async function getWaitStatus(eventId, userId) {
  const res = await axios.get(`${API_URL}/api/events/${eventId}/wait-status/${userId}`);
  return res.data;
}

export async function runMatching(eventId) {
  const res = await axios.post(`${API_URL}/api/events/${eventId}/run-matching`);
  return res.data;
}

export async function fetchUserChats(userId) {
  const res = await axios.get(`${API_URL}/api/groups/user/${userId}`);
  return res.data;
}

export async function fetchEvents() {
  const res = await axios.get(`${API_URL}/api/events`);
  return res.data;
}

export async function createEvent(eventData) {
  const res = await axios.post(`${API_URL}/api/events`, eventData);
  return res.data;
}

// ----------------------
// MATCH SYSTEM
// ----------------------
export async function requestMatch(eventId, mode, preferences, users) {
    const res = await axios.post(`${API_URL}/api/events/${eventId}/match`, {
        mode,
        preferences,
        users
    });
    return res.data;
}

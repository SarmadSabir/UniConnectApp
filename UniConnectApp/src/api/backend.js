import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Your laptop's Wi-Fi IPv4 address
const API_URL = "http://192.168.0.105:4000";

const AUTH_STORAGE_KEYS = ["token", "userId", "userName", "userRole"];
let inMemoryToken = null;

const hasPreferenceValue = (value) => {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
};

const normalizePreferencesPayload = (prefs) => {
  if (!prefs || typeof prefs !== "object") return null;
  const clean = {};
  Object.entries(prefs).forEach(([key, value]) => {
    if (!hasPreferenceValue(value)) return;
    if (Array.isArray(value)) {
      clean[key] = value.filter(Boolean);
      return;
    }
    if (typeof value === "boolean") {
      if (value) clean[key] = true;
      return;
    }
    clean[key] = value;
  });
  return Object.keys(clean).length ? clean : null;
};

async function ensureInMemoryToken() {
  if (inMemoryToken) return inMemoryToken;
  const stored = await AsyncStorage.getItem("token");
  inMemoryToken = stored;
  return stored;
}

async function buildAuthHeaders() {
  const token = await ensureInMemoryToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function clearStoredSession() {
  inMemoryToken = null;
  await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS);
}

async function handleAuthRequest(executor) {
  try {
    return await executor();
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401) {
      await clearStoredSession();
      const authErr = new Error(err?.response?.data?.error || "Session expired");
      authErr.code = "AUTH_EXPIRED";
      throw authErr;
    }
    throw err;
  }
}

// ----------------------
// AUTH
// ----------------------
export async function signup(userData) {
  const res = await axios.post(`${API_URL}/api/auth/signup?overwrite=true`, userData);
  inMemoryToken = res.data.token;
  await AsyncStorage.setItem("token", res.data.token);
  await AsyncStorage.setItem("userId", res.data.user._id);
  await AsyncStorage.setItem("userName", res.data.user.name || "");
  await AsyncStorage.setItem("userRole", res.data.user.role || "user");
  return res.data.user;
}

export async function login(credentials) {
  const payload = {
    ...credentials,
    university_email: credentials.university_email?.trim().toLowerCase(),
  };
  const res = await axios.post(`${API_URL}/api/auth/login`, payload);
  inMemoryToken = res.data.token;
  await AsyncStorage.setItem("token", res.data.token);
  await AsyncStorage.setItem("userId", res.data.user._id);
  await AsyncStorage.setItem("userName", res.data.user.name || "");
  await AsyncStorage.setItem("userRole", res.data.user.role || "user");
  return res.data.user;
}

export async function logout() {
  await clearStoredSession();
}

export async function joinEvent(eventId, userId, preferences = null) {
  const payload = { user_id: userId };
  const normalizedPreferences = normalizePreferencesPayload(preferences);
  if (normalizedPreferences) {
    payload.preferences = normalizedPreferences;
  }
  const res = await axios.post(`${API_URL}/api/events/${eventId}/join`, payload);
  return res.data;
}

export async function getWaitStatus(eventId, userId) {
  const res = await axios.get(`${API_URL}/api/events/${eventId}/wait-status/${userId}`);
  return res.data;
}

export async function respondToHardFilterPrompt(eventId, userId, action = "accept") {
  const res = await axios.post(
    `${API_URL}/api/events/${eventId}/waitlist/${userId}/hard-filter-opt-in`,
    { action }
  );
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
  const headers = await buildAuthHeaders();
  const res = await handleAuthRequest(() =>
    axios.post(`${API_URL}/api/events`, eventData, { headers })
  );
  return res.data;
}

export async function deleteEvent(eventId) {
  if (!eventId) {
    throw new Error("eventId is required");
  }
  const headers = await buildAuthHeaders();
  const res = await handleAuthRequest(() =>
    axios.delete(`${API_URL}/api/events/${eventId}`, { headers })
  );
  return res.data;
}

// ----------------------
// MATCH SYSTEM
// ----------------------
export async function requestMatch(eventId, mode, preferences, users) {
  const res = await axios.post(`${API_URL}/api/events/${eventId}/match`, {
    mode,
    preferences,
    users,
  });
  return res.data;
}

// ----------------------
// ADMIN & REPORTING
// ----------------------
export async function fetchComplaints() {
  const headers = await buildAuthHeaders();
  const res = await handleAuthRequest(() =>
    axios.get(`${API_URL}/api/complaints`, { headers })
  );
  return res.data;
}

export async function updateComplaintStatus(id, status) {
  const headers = await buildAuthHeaders();
  const res = await handleAuthRequest(() =>
    axios.patch(
      `${API_URL}/api/complaints/${id}/status`,
      { status },
      { headers }
    )
  );
  return res.data;
}

export async function submitComplaint(payload) {
  const headers = await buildAuthHeaders();
  const res = await handleAuthRequest(() =>
    axios.post(`${API_URL}/api/complaints`, payload, { headers })
  );
  return res.data;
}

export async function deleteUserAccount(userId) {
  if (!userId) {
    throw new Error("userId required");
  }
  const headers = await buildAuthHeaders();
  const res = await handleAuthRequest(() =>
    axios.delete(`${API_URL}/api/admin/users/${userId}`, { headers })
  );
  return res.data;
}

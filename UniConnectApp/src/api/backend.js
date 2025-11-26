import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Your laptop's Wi-Fi IPv4 address
const API_URL = "http://192.168.18.173:4000";

const AUTH_STORAGE_KEYS = ["token", "userId", "userName", "userRole"];
let inMemoryToken = null;

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
  if (preferences && Object.values(preferences).some(Boolean)) {
    payload.preferences = preferences;
  }
  const res = await axios.post(`${API_URL}/api/events/${eventId}/join`, payload);
  return res.data;
}

export async function getWaitStatus(eventId, userId) {
  const res = await axios.get(`${API_URL}/api/events/${eventId}/wait-status/${userId}`);
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

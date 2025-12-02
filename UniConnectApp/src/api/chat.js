import axios from "axios";

const API_URL = "http://192.168.0.105:4000";

export async function getChatroom(chatroomId) {
  const res = await axios.get(`${API_URL}/api/chat/${chatroomId}`);
  return res.data;
}

export async function sendMessage(chatroomId, sender, text) {
  const res = await axios.post(`${API_URL}/api/chat/${chatroomId}/message`, {
    sender,
    text
  });
  return res.data;
}

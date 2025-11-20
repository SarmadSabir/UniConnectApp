import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { getChatroom, sendMessage } from "../api/chat";
import AsyncStorage from "@react-native-async-storage/async-storage";

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value.$oid) return value.$oid;
    if (value._id) return toIdString(value._id);
    if (typeof value.toString === "function") return value.toString();
  }
  return "";
};

const formatMemberLabel = (value = "") => {
  if (typeof value === "object" && value?.name) {
    return value.name;
  }
  const str = toIdString(value);
  if (!str) return "";
  return `#${str.slice(-4)}`;
};

const getMemberKey = (value, index) => {
  const str = toIdString(value);
  if (str) return str;
  return `member-${index}`;
};

const ChatBubble = ({ item, isMine }) => (
  <View
    style={[
      styles.bubble,
      isMine ? styles.myBubble : styles.theirBubble,
      isMine ? styles.alignRight : styles.alignLeft,
    ]}
  >
    <Text style={[styles.bubbleSender, isMine && styles.myBubbleSender]}>
      {formatMemberLabel(item.sender)}
    </Text>
    <Text style={[styles.bubbleText, isMine && styles.myBubbleText]}>{item.text}</Text>
  </View>
);

export default function GroupChatScreen({ route }) {
  const { groupId, chatroomId, members = [] } = route.params;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("userId").then((id) => setUserId(id));
  }, []);

  const loadMessages = useCallback(
    async (withSpinner = false) => {
      try {
        if (withSpinner) setLoading(true);
        const res = await getChatroom(chatroomId);
        setMessages(res.chat?.messages || []);
      } catch (err) {
        console.error("Failed to load chat", err);
      } finally {
        if (withSpinner) setLoading(false);
      }
    },
    [chatroomId]
  );

  useEffect(() => {
    loadMessages(true);
  }, [loadMessages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!userId) {
      alert("Still loading your profile. Please wait a moment.");
      return;
    }
    try {
      setSending(true);
      await sendMessage(chatroomId, userId, input.trim());
      setInput("");
      await loadMessages();
    } catch (err) {
      console.error("Unable to send message", err);
      alert("Unable to send message. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Group Chat</Text>
            <Text style={styles.headerSubtitle}>
              Room {formatMemberLabel(groupId)} | {members.length} members
            </Text>
          </View>
        </View>

        <View style={styles.memberBox}>
          <Text style={styles.memberLabel}>Members</Text>
          <View style={styles.memberList}>
            {members.map((m, index) => (
              <View key={getMemberKey(m, index)} style={styles.memberPill}>
                <Text style={styles.memberText}>{formatMemberLabel(m)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.chatContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#5B67F1" style={styles.loader} />
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(item, index) => item._id || `${toIdString(item.sender)}-${index}`}
              contentContainerStyle={styles.chatContent}
              renderItem={({ item }) => {
                const senderId = toIdString(item.sender);
                return (
                  <ChatBubble item={item} isMine={Boolean(userId) && senderId === userId} />
                );
              }}
            />
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor="#8A8FA6"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (sending || !input.trim()) && styles.disabledButton,
            ]}
            onPress={handleSend}
            disabled={sending || !input.trim()}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  flex: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  header: {
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#10194E",
  },
  headerSubtitle: {
    color: "#4E5876",
    marginTop: 4,
  },
  memberBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  memberLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5B67F1",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  memberList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginVertical: -4,
  },
  memberPill: {
    backgroundColor: "#EFF1FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  memberText: {
    color: "#5B67F1",
    fontWeight: "600",
  },
  chatContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  chatContent: {
    paddingVertical: 6,
  },
  loader: {
    marginTop: 20,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    marginVertical: 4,
  },
  bubbleSender: {
    fontSize: 12,
    color: "#7D859E",
    marginBottom: 4,
  },
  bubbleText: {
    fontSize: 15,
    color: "#10194E",
  },
  myBubble: {
    backgroundColor: "#5B67F1",
    borderBottomRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: "#EFF1FF",
    borderBottomLeftRadius: 2,
  },
  myBubbleText: {
    color: "#fff",
  },
  myBubbleSender: {
    color: "#D9DDFF",
  },
  alignRight: {
    alignSelf: "flex-end",
  },
  alignLeft: {
    alignSelf: "flex-start",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#D2D7F9",
    color: "#10194E",
  },
  sendButton: {
    backgroundColor: "#5B67F1",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  sendText: {
    color: "#fff",
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
});

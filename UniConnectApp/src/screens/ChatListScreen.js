import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { fetchUserChats, fetchEvents } from "../api/backend";
import { SafeAreaView } from "react-native-safe-area-context";

const toEventKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value.$oid) return value.$oid;
    if (value._id) return toEventKey(value._id);
  }
  if (typeof value.toString === "function") return value.toString();
  return "";
};

const slugify = (value) => {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const collectEventKeys = (event) => {
  if (!event) return [];
  const keys = new Set();
  const push = (val) => {
    const key = toEventKey(val);
    if (key) keys.add(key);
  };
  push(event._id);
  push(event.id);
  push(event.event_id);
  if (Array.isArray(event.ids)) {
    event.ids.forEach(push);
  }
  const slug = slugify(event.title || event.name || "");
  if (slug) keys.add(slug);
  return [...keys];
};

const formatMemberLabel = (value = "") => {
  if (!value) return "";
  if (typeof value === "object") {
    if (value?.name) return value.name;
    if (value?._id) return `#${value._id.slice(-4)}`;
  }
  if (typeof value === "string") return `#${value.slice(-4)}`;
  if (typeof value.toString === "function") {
    const str = value.toString();
    return `#${str.slice(-4)}`;
  }
  return "";
};

export default function ChatListScreen() {
  const navigation = useNavigation();
  const [userId, setUserId] = useState(null);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventNames, setEventNames] = useState({});

  useEffect(() => {
    AsyncStorage.getItem("userId").then((id) => setUserId(id));
  }, []);

  const loadChats = useCallback(
    async (withSpinner = false) => {
      if (!userId) return;
      try {
        if (withSpinner) setLoading(true);
        const res = await fetchUserChats(userId);
        setChats(res.groups || []);
      } catch (err) {
        console.error("Failed to load chats", err);
      } finally {
        if (withSpinner) setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetchEvents();
        const map = {};
        (res.events || []).forEach((evt) => {
          const label = evt.title || evt.name || "UniConnect Event";
          collectEventKeys(evt).forEach((key) => {
            if (key) {
              map[key] = label;
            }
          });
        });
        setEventNames(map);
      } catch (err) {
        console.error("Failed to load events for chat list", err);
      }
    };
    loadEvents();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChats(true);
    }, [loadChats])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  }, [loadChats]);

  const openChat = (item) => {
    if (!item?.chatroom || !item?.group) return;
    navigation.navigate("GroupChat", {
      groupId: item.group._id,
      chatroomId: item.chatroom._id,
      members: item.group.members,
    });
  };

  const getEventName = (group) => {
    const key = toEventKey(group?.event_id);
    if (key && eventNames[key]) {
      return eventNames[key];
    }
    if (group?.event_id) {
      const short = key || `${group.event_id}`;
      return `Event ${short.slice(-6)}`;
    }
    return "UniConnect Event";
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.chatCard} onPress={() => openChat(item)}>
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle}>{getEventName(item.group)}</Text>
        <Text style={styles.chatMembers}>
          {item.group.members.length} members
        </Text>
      </View>
      <View style={styles.memberRow}>
        {item.group.members.slice(0, 3).map((m, idx) => (
          <Text key={`${item.group._id}-${idx}`} style={styles.memberTag}>
            {formatMemberLabel(m)}
          </Text>
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Chats</Text>
        <TouchableOpacity style={styles.reportButton} onPress={() => navigation.navigate("ReportUser")}>
          <Text style={styles.reportButtonText}>Report</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#5B67F1" />
      ) : chats.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptySubtitle}>
            Join an event and we’ll drop your matches here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item, index) => item.group?._id || `${index}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: Platform.OS === "android" ? 24 : 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  screenTitle: {
    color: "#F5F7FF",
    fontSize: 24,
    fontWeight: "700",
  },
  reportButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  reportButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 80,
  },
  chatCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#10194E",
  },
  chatMembers: {
    color: "#4E5876",
  },
  memberRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  memberTag: {
    backgroundColor: "#EFF1FF",
    color: "#5B67F1",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "600",
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#10194E",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "#4E5876",
    textAlign: "center",
    paddingHorizontal: 24,
  },
});

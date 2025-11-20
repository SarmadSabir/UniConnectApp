import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  joinEvent,
  runMatching,
  logout,
  getWaitStatus,
  fetchUserChats,
} from "../api/backend";
import AsyncStorage from "@react-native-async-storage/async-storage";

const defaultEvent = {
  id: "campus-creator-lab",
  name: "Campus Creator Lab",
  description: "Build prototypes with founders, designers, and researchers all weekend.",
};

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

const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value?._id) return normalizeId(value._id);
  if (value?.$oid) return value.$oid;
  if (typeof value.toString === "function") return value.toString();
  return "";
};

export default function EventDetailsScreen({ route, navigation }) {
  const [eventDetails, setEventDetails] = useState(route.params?.event || defaultEvent);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [matchedForCurrentEvent, setMatchedForCurrentEvent] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Tap Go Solo and we'll put you in the waitlist."
  );

  const currentEventId = eventDetails?.id || eventDetails?._id || defaultEvent.id;
  const currentEventKey = toEventKey(currentEventId);
  const currentEventName = eventDetails?.name || eventDetails?.title || "UniConnect Event";
  const currentEventDescription =
    eventDetails?.description || "Get matched with students who vibe with you.";

  useEffect(() => {
    AsyncStorage.multiGet(["userId", "userName"]).then((entries) => {
      const map = Object.fromEntries(entries);
      if (map.userId) setUserId(map.userId);
      if (map.userName) setUserName(map.userName);
    });
  }, []);

  useEffect(() => {
    if (route.params?.event) {
      setEventDetails(route.params.event);
    } else {
      setEventDetails(defaultEvent);
    }
    setActiveChat(null);
    setHasJoined(false);
    setStatusMessage("Tap Go Solo and we'll put you in the waitlist.");
    setMatchedForCurrentEvent(false);
  }, [route.params?.event]);

  const refreshMembership = useCallback(async () => {
    if (!userId) return false;
    try {
      const res = await fetchUserChats(userId);
      let matchingGroup = null;
      let matched = false;

      if (res.groups && res.groups.length > 0) {
        res.groups.forEach((item) => {
          const eventId = toEventKey(item?.group?.event_id);
          if (eventId && eventId === currentEventKey) {
            matched = true;
            if (!matchingGroup) {
              matchingGroup = item;
            }
          }
        });
      }

      setMatchedForCurrentEvent(matched);

      if (matchingGroup) {
        setActiveChat(matchingGroup);
        setStatusMessage("You're matched! Head to the Chats tab to keep talking.");
        setHasJoined(false);
        return true;
      }

      setActiveChat(null);
      if (matched) {
        setStatusMessage("You're matched! Head to the Chats tab to keep talking.");
      }
      return matched;
    } catch (err) {
      console.error("Failed to load chats", err);
      setMatchedForCurrentEvent(false);
      return false;
    }
  }, [userId, currentEventKey]);

  const refreshWaitStatus = useCallback(async () => {
    if (!userId || !currentEventId) return;
    try {
      const res = await getWaitStatus(currentEventId, userId);
      if (res.waiting) {
        setHasJoined(true);
        setStatusMessage("You're on the waitlist. We'll notify you when a group is ready.");
      } else if (!activeChat && !matchedForCurrentEvent) {
        setHasJoined(false);
        setStatusMessage("Tap Go Solo and we'll put you in the waitlist.");
      }
    } catch (err) {
      console.error("Failed to fetch wait status", err);
    }
  }, [userId, currentEventId, activeChat, matchedForCurrentEvent]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const matched = await refreshMembership();
      if (!matched) {
        await refreshWaitStatus();
      }
    })();
  }, [userId, refreshMembership, refreshWaitStatus]);

  const navigateToChat = useCallback(
    (groupDoc) => {
      navigation.navigate("GroupChat", {
        groupId: groupDoc.group._id,
        chatroomId: groupDoc.chatroom._id,
        members: groupDoc.group.members,
      });
    },
    [navigation]
  );

  const attemptMatch = useCallback(async () => {
    try {
      setMatching(true);
      const res = await runMatching(currentEventId);
      if (res.success && Array.isArray(res.groups) && res.groups.length > 0) {
        const myGroup = res.groups.find((item) =>
          item?.group?.members?.some((member) => normalizeId(member) === userId)
        );
        if (myGroup && myGroup.group && myGroup.chatroom) {
          setStatusMessage("Match found! Opening your chat.");
          navigateToChat(myGroup);
        } else {
          const msg = res.message || "Waiting for more users to join.";
          setStatusMessage(msg);
          Alert.alert("Hang tight", msg);
        }
      } else {
        const msg = res.message || "Waiting for more users to join.";
        setStatusMessage(msg);
        Alert.alert("Hang tight", msg);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Match error", "Unable to run matching right now.");
    } finally {
      setMatching(false);
      await refreshMembership();
      await refreshWaitStatus();
    }
  }, [currentEventId, userId, navigateToChat, refreshMembership, refreshWaitStatus]);

  const handleGoSolo = async () => {
    if (!userId) {
      Alert.alert("Hold on", "User not logged in.");
      return;
    }
    if (activeChat || matchedForCurrentEvent) {
      Alert.alert("Already matched", "You already have a group. Check the Chats tab.");
      return;
    }
    if (hasJoined) {
      Alert.alert("You're already queued", "We're waiting for more participants to join.");
      return;
    }

    setLoading(true);
    try {
    const response = await joinEvent(currentEventId, userId);
      setHasJoined(true);
      setStatusMessage("You're on the waitlist. We'll notify you when a group is ready.");
      if (response?.alreadyQueued) {
        Alert.alert("You're already queued", "Sit tight while we find your partners.");
      } else {
        await attemptMatch();
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not join the event.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckMatch = async () => {
    if (activeChat) {
      navigateToChat(activeChat);
      return;
    }
    if (!hasJoined) {
      Alert.alert("Join first", "Hop on the waitlist before checking for matches.");
      return;
    }
    await attemptMatch();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigation.replace("Login");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>
            {userName ? `Welcome back, ${userName}` : "Welcome back"}
          </Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroGreeting}>
            {userName ? `Hey ${userName.split(" ")[0]} 👋` : "Ready to connect?"}
          </Text>
          <Text style={styles.heroTitle}>{currentEventName}</Text>
          <Text style={styles.heroSubtitle}>{currentEventDescription}</Text>
          <View style={styles.heroChipRow}>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>Status</Text>
              <Text style={styles.heroChipValue}>
                {activeChat ? "Matched" : hasJoined ? "Waiting" : "Ready"}
              </Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>Current group</Text>
              <Text style={styles.heroChipValue}>
                {activeChat?.group?.members?.length || "—"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eventTag}>Featured Event</Text>
          <Text style={styles.title}>{currentEventName}</Text>
          <Text style={styles.desc}>{currentEventDescription || "Details coming soon."}</Text>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusMessage}>{statusMessage}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (loading || hasJoined || activeChat || matchedForCurrentEvent) && styles.disabledButton,
            ]}
            onPress={handleGoSolo}
            disabled={Boolean(loading || hasJoined || activeChat || matchedForCurrentEvent)}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {activeChat
                  ? "Group ready"
                  : hasJoined
                  ? "You're already queued"
                  : "Go Solo (AI decide)"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              ((hasJoined === false && !activeChat) || matching) && styles.disabledSecondary,
            ]}
            onPress={handleCheckMatch}
            disabled={Boolean((hasJoined === false && !activeChat) || matching)}
          >
            {matching ? (
              <ActivityIndicator color="#5B67F1" />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {activeChat ? "Open my chat" : "Check for matches"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate("MatchPreferences", { event: eventDetails })}
          >
            <Text style={styles.linkButtonText}>Choose match type</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.altLinkButton}
          onPress={() => navigation.navigate("EventList")}
        >
          <Text style={styles.altLinkText}>Browse other events</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  container: {
    paddingHorizontal: 24,
    paddingBottom: 80,
    paddingTop: Platform.OS === "android" ? 20 : 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  brand: {
    fontSize: 26,
    fontWeight: "700",
    color: "#F5F7FF",
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "600",
  },
  heroCard: {
    backgroundColor: "rgba(91, 103, 241, 0.85)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heroGreeting: {
    color: "#E3E6FF",
    fontSize: 14,
    marginBottom: 4,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 6,
  },
  heroSubtitle: {
    color: "#F7F8FF",
    opacity: 0.9,
    marginBottom: 14,
  },
  heroChipRow: {
    flexDirection: "row",
    gap: 12,
  },
  heroChip: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flex: 1,
  },
  heroChipLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: 4,
  },
  heroChipValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  eventTag: {
    color: "#5B67F1",
    fontWeight: "600",
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
    color: "#0F1840",
  },
  desc: {
    fontSize: 16,
    color: "#4E5876",
    marginBottom: 20,
  },
  statusBox: {
    backgroundColor: "rgba(91, 103, 241, 0.08)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 12,
    color: "#4E5DFB",
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: 4,
  },
  statusMessage: {
    color: "#10194E",
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: "#5B67F1",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#5B67F1",
    marginBottom: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledSecondary: {
    borderColor: "#BBC2F9",
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: "#5B67F1",
    fontWeight: "600",
    fontSize: 16,
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  linkButtonText: {
    color: "#4E5876",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  altLinkButton: {
    marginTop: 18,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  altLinkText: {
    color: "#F5F7FF",
    fontWeight: "600",
  },
});

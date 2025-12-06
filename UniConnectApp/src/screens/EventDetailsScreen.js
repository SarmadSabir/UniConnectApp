import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  logout,
  getWaitStatus,
  fetchUserChats,
  respondToHardFilterPrompt,
} from "../api/backend";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MATCHED_EVENTS_KEY = "matchedEventIds";
const matchedKeyForUser = (uid) =>
  uid ? `${MATCHED_EVENTS_KEY}:${uid}` : MATCHED_EVENTS_KEY;

const loadMatchedEventsForUser = async (uid) => {
  if (!uid) {
    return [];
  }
  const storageKey = matchedKeyForUser(uid);
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to parse matched events cache", err);
    return [];
  }
};

const persistMatchedEventsForUser = async (uid, events) => {
  if (!uid) return;
  const storageKey = matchedKeyForUser(uid);
  await AsyncStorage.setItem(storageKey, JSON.stringify(events));
};

const defaultEvent = {
  id: "campus-creator-lab",
  name: "Campus Creator Lab",
  description: "Build prototypes with founders, designers, and researchers all weekend.",
};

const hasMeaningfulPreference = (prefs) => {
  if (!prefs || typeof prefs !== "object") return false;
  return Object.values(prefs).some((value) => {
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined;
  });
};

const sanitizePreferences = (prefs) => {
  if (!prefs || typeof prefs !== "object") return null;
  const clean = {};
  Object.entries(prefs).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      if (value) clean[key] = true;
      return;
    }
    if (Array.isArray(value) && value.length) {
      clean[key] = value;
      return;
    }
    if (value !== null && value !== undefined) {
      clean[key] = value;
    }
  });
  return Object.keys(clean).length ? clean : null;
};

const slugify = (value) => {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

const collectEventKeys = (eventLike) => {
  const keys = new Set();
  const addKey = (value) => {
    const key = toEventKey(value);
    if (key) keys.add(key);
  };
  if (!eventLike) return [...keys];
  if (typeof eventLike === "string") {
    addKey(eventLike);
    return [...keys];
  }
  addKey(eventLike.id);
  addKey(eventLike._id);
  addKey(eventLike.event_id);
  addKey(eventLike.legacyId);
  if (Array.isArray(eventLike.ids)) {
    eventLike.ids.forEach(addKey);
  }
  const label = eventLike.name || eventLike.title;
  const slug = slugify(label);
  if (slug) keys.add(slug);
  return [...keys];
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
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState(
    "Tap AI MATCH and we'll put you in the waitlist."
  );
  const [matchPreferences, setMatchPreferences] = useState(
    sanitizePreferences(route.params?.prefs)
  );
  const [hardFilterPrompt, setHardFilterPrompt] = useState(null);
  const [promptActionLoading, setPromptActionLoading] = useState(false);
  const firstName = useMemo(() => {
    if (!userName) return "";
    const trimmed = userName.trim();
    if (!trimmed) return "";
    const segments = trimmed.split(/\s+/);
    return segments[0] || trimmed;
  }, [userName]);

  const currentEventId = eventDetails?.id || eventDetails?._id || defaultEvent.id;
  const currentEventKeys = useMemo(() => {
    const payload = eventDetails ? { ...eventDetails } : { ...defaultEvent };
    payload.id = payload.id || currentEventId;
    const keys = collectEventKeys(payload);
    return keys.length ? keys : collectEventKeys(defaultEvent);
  }, [eventDetails, currentEventId]);
  const currentEventKey = currentEventKeys[0] || "";
  const currentEventKeysSignature = currentEventKeys.join("|");
  const currentEventName = eventDetails?.name || eventDetails?.title || "UniConnect Event";
  const currentEventDescription =
    eventDetails?.description || "Get matched with students who vibe with you.";
  const latestEventKeyRef = useRef(currentEventKey);

  useEffect(() => {
    latestEventKeyRef.current = currentEventKey;
  }, [currentEventKey]);

  useEffect(() => {
    AsyncStorage.multiGet(["userId", "userName"]).then((entries) => {
      const map = Object.fromEntries(entries);
      if (map.userId) setUserId(map.userId);
      if (map.userName) setUserName(map.userName);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    AsyncStorage.removeItem(MATCHED_EVENTS_KEY).catch((err) => {
      console.error("Failed to clear legacy matched events cache", err);
    });
  }, [userId]);

  useEffect(() => {
    if (route.params?.prefs === undefined) return;
    setMatchPreferences(sanitizePreferences(route.params?.prefs));
  }, [route.params?.prefs]);

  useEffect(() => {
    let cancelled = false;
    const hydrateEvent = async () => {
      const newEvent = route.params?.event || defaultEvent;
      setEventDetails(newEvent);
      setActiveChat(null);
      setHasJoined(false);
      setStatusLoading(true);

      const eventKeys = collectEventKeys(newEvent);
      const previouslyMatched = await wasMatchedBefore(eventKeys);
      if (cancelled) return;
      setMatchedForCurrentEvent(Boolean(previouslyMatched));
      setStatusMessage(
        previouslyMatched
          ? "You're matched! Head to the Chats tab to keep talking."
          : "Tap AI MATCH and we'll put you in the waitlist."
      );
      setStatusLoading(false);
    };
    hydrateEvent();
    return () => {
      cancelled = true;
    };
  }, [route.params?.event, wasMatchedBefore]);

  useEffect(() => {
    (async () => {
      const wasMatched = await wasMatchedBefore(currentEventKeys);
      if (wasMatched) {
        setMatchedForCurrentEvent(true);
        setStatusMessage("You're matched! Head to the Chats tab to keep talking.");
        setStatusLoading(false);
      }
    })();
  }, [currentEventKeysSignature, wasMatchedBefore]);

  const rememberMatchedEvent = useCallback(async (eventKeys) => {
    if (!userId) return;
    const keys = Array.isArray(eventKeys) ? eventKeys : [eventKeys];
    const normalized = keys.map((value) => toEventKey(value)).filter(Boolean);
    if (!normalized.length) return;
    try {
      const existing = await loadMatchedEventsForUser(userId);
      const set = new Set(Array.isArray(existing) ? existing : []);
      normalized.forEach((key) => set.add(key));
      await persistMatchedEventsForUser(userId, [...set]);
    } catch (err) {
      console.error("Failed to persist matched events", err);
    }
  }, [userId]);

  const wasMatchedBefore = useCallback(async (eventKeys) => {
    if (!userId) return false;
    const keys = Array.isArray(eventKeys) ? eventKeys : [eventKeys];
    const normalized = keys.map((value) => toEventKey(value)).filter(Boolean);
    if (!normalized.length) return false;
    try {
      const list = await loadMatchedEventsForUser(userId);
      return Array.isArray(list) && normalized.some((key) => list.includes(key));
    } catch (err) {
      console.error("Failed to read matched events", err);
      return false;
    }
  }, [userId]);

  const refreshMembership = useCallback(async () => {
    if (!userId) return false;
    const eventKey = currentEventKey;
    const eventKeys = currentEventKeys;
    const isFresh = () => eventKey === latestEventKeyRef.current;
    try {
      setStatusLoading(true);
      const res = await fetchUserChats(userId);
      if (!isFresh()) return false;
      let matchingGroup = null;
      let matched = false;

      if (res.groups && res.groups.length > 0) {
        res.groups.forEach((item) => {
          const eventId = toEventKey(item?.group?.event_id);
          if (eventId && eventKeys.includes(eventId)) {
            matched = true;
            if (!matchingGroup) {
              matchingGroup = item;
            }
          }
        });
      }

      if (!isFresh()) return false;
      setMatchedForCurrentEvent(matched);

      if (matchingGroup) {
        if (!isFresh()) return false;
        setActiveChat(matchingGroup);
        setStatusMessage("You're matched! Head to the Chats tab to keep talking.");
        setHasJoined(false);
        setHardFilterPrompt(null);
        const backendKey = toEventKey(matchingGroup?.group?.event_id);
        const keysToStore = backendKey ? [backendKey, ...eventKeys] : eventKeys;
        await rememberMatchedEvent(keysToStore);
        return matchingGroup;
      }

      const previouslyMatched = await wasMatchedBefore(eventKeys);
      if (!isFresh()) return false;
      const anyMatch = matched || previouslyMatched;

      setActiveChat(null);
      setMatchedForCurrentEvent(anyMatch);
      if (anyMatch) {
        setHardFilterPrompt(null);
      }
      if (anyMatch) {
        setStatusMessage("You're matched! Head to the Chats tab to keep talking.");
      }
      return anyMatch;
    } catch (err) {
      console.error("Failed to load chats", err);
      const fallbackMatched = await wasMatchedBefore(eventKeys);
      if (!isFresh()) return false;
      setMatchedForCurrentEvent(fallbackMatched);
      return false;
    } finally {
      if (isFresh()) {
        setStatusLoading(false);
      }
    }
  }, [userId, currentEventKey, currentEventKeysSignature, rememberMatchedEvent, wasMatchedBefore]);

  const refreshWaitStatus = useCallback(async () => {
    if (!userId || !currentEventId) return;
    const eventKey = currentEventKey;
    const isFresh = () => eventKey === latestEventKeyRef.current;
    try {
      setStatusLoading(true);
      const res = await getWaitStatus(currentEventId, userId);
      if (!isFresh()) return;
      if (res.waiting && res.hardFilterPrompt) {
        setHardFilterPrompt(res.hardFilterPrompt);
      } else {
        setHardFilterPrompt(null);
      }
      if (res.waiting) {
        setHasJoined(true);
        setStatusMessage("You're on the waitlist. We'll notify you when a group is ready.");
      } else if (!activeChat && !matchedForCurrentEvent) {
        setHasJoined(false);
        setStatusMessage("Tap AI MATCH and we'll put you in the waitlist.");
      }
    } catch (err) {
      console.error("Failed to fetch wait status", err);
    } finally {
      if (isFresh()) {
        setStatusLoading(false);
      }
    }
  }, [userId, currentEventId, currentEventKey, activeChat, matchedForCurrentEvent]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const matched = await refreshMembership();
      if (!matched) {
        await refreshWaitStatus();
      }
    })();
  }, [userId, refreshMembership, refreshWaitStatus]);

  useEffect(() => {
    const keyFromChat = toEventKey(activeChat?.group?.event_id);
    if (activeChat && keyFromChat && currentEventKeys.includes(keyFromChat)) {
      setMatchedForCurrentEvent(true);
      rememberMatchedEvent([keyFromChat, ...currentEventKeys]);
    }
  }, [activeChat, currentEventKeysSignature, rememberMatchedEvent]);

  const navigateToChat = useCallback(
    (groupDoc) => {
      navigation.navigate("GroupChat", {
        groupId: groupDoc.group._id,
        chatroomId: groupDoc.chatroom._id,
        members: groupDoc.group.members,
        eventName: currentEventName,
      });
    },
    [navigation, currentEventName]
  );

  const attemptMatch = useCallback(async () => {
    try {
      setMatching(true);
      const matchResult = await refreshMembership();
      if (matchResult && matchResult.group && matchResult.chatroom) {
        setStatusMessage("Match found! Opening your chat.");
        navigateToChat(matchResult);
        return;
      }
      await refreshWaitStatus();
      setStatusMessage("Still collecting the best partners for you. Hang tight.");
      Alert.alert(
        "Still waiting",
        "We're batching everyone and will notify you the moment a quality group is ready."
      );
    } catch (err) {
      console.error("Match status error", err);
      Alert.alert("Status error", "Unable to refresh match status right now.");
    } finally {
      setMatching(false);
    }
  }, [navigateToChat, refreshMembership, refreshWaitStatus]);

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
      const response = await joinEvent(currentEventId, userId, matchPreferences);
      setHasJoined(true);
      setStatusMessage("You're on the waitlist. We'll notify you when a group is ready.");
      if (response?.alreadyQueued) {
        Alert.alert("You're already queued", "Sit tight while we find your partners.");
      } else {
        await refreshWaitStatus();
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

  const handlePromptDecision = useCallback(
    async (action) => {
      if (!userId || !currentEventId) return;
      try {
        setPromptActionLoading(true);
        await respondToHardFilterPrompt(currentEventId, userId, action);
        await refreshWaitStatus();
        if (action === "accept") {
          setStatusMessage("Got it! We'll match you with anyone available next.");
        }
      } catch (err) {
        console.error("Hard-filter prompt action failed", err);
        Alert.alert("Please retry", "We couldn't update your waitlist preference yet.");
      } finally {
        setPromptActionLoading(false);
      }
    },
    [userId, currentEventId, refreshWaitStatus]
  );

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
          <Text style={styles.brand} numberOfLines={1} adjustsFontSizeToFit>
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroGreeting}>
            {firstName ? `Hey ${firstName} 👋` : "Ready to connect?"}
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
            {hardFilterPrompt && (
              <View style={styles.promptBox}>
                <Text style={styles.promptTitle}>We can broaden your pool</Text>
                <Text style={styles.promptMessage}>
                  {hardFilterPrompt.message ||
                    "Still waiting on your filters. Want to match with anyone?"}
                </Text>
                <View style={styles.promptActions}>
                  <TouchableOpacity
                    style={[
                      styles.promptButton,
                      styles.promptPrimary,
                      styles.promptButtonLeft,
                      promptActionLoading && styles.disabledButton,
                    ]}
                    disabled={promptActionLoading}
                    onPress={() => handlePromptDecision("accept")}
                  >
                    {promptActionLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.promptPrimaryText}>Yes, match anyone</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.promptButton,
                      styles.promptSecondary,
                      styles.promptButtonRight,
                      promptActionLoading && styles.disabledButton,
                    ]}
                    disabled={promptActionLoading}
                    onPress={() => handlePromptDecision("decline")}
                  >
                    <Text style={styles.promptSecondaryText}>Keep filters</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (loading ||
                statusLoading ||
                hasJoined ||
                activeChat ||
                matchedForCurrentEvent) &&
                styles.disabledButton,
            ]}
            onPress={handleGoSolo}
            disabled={Boolean(
              loading || statusLoading || hasJoined || activeChat || matchedForCurrentEvent
            )}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {activeChat
                  ? "Group ready"
                  : hasJoined
                  ? "You're already queued"
                  : "AI MATCH"}
              </Text>
            )}
          </TouchableOpacity>

          {/* <TouchableOpacity
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
          </TouchableOpacity> */}

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() =>
              navigation.navigate("MatchPreferences", {
                event: eventDetails,
                prefs: matchPreferences,
              })
            }
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
    columnGap: 12,
    marginBottom: 20,
  },
  brand: {
    fontSize: 26,
    fontWeight: "700",
    color: "#F5F7FF",
    flexShrink: 1,
    marginRight: 12,
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    flexShrink: 0,
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
  promptBox: {
    marginTop: 14,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(91,103,241,0.12)",
  },
  promptTitle: {
    fontWeight: "700",
    color: "#10194E",
    marginBottom: 4,
  },
  promptMessage: {
    color: "#253064",
    marginBottom: 6,
  },
  promptMeta: {
    fontSize: 12,
    color: "#5B67F1",
    marginBottom: 10,
  },
  promptActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  promptButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    marginBottom: 8,
  },
  promptPrimary: {
    backgroundColor: "#5B67F1",
  },
  promptButtonLeft: {
    marginRight: 6,
  },
  promptButtonRight: {
    marginLeft: 6,
  },
  promptSecondary: {
    borderWidth: 1,
    borderColor: "#5B67F1",
    backgroundColor: "#fff",
  },
  promptPrimaryText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  promptSecondaryText: {
    color: "#5B67F1",
    fontWeight: "600",
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

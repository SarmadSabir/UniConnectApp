import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { fetchEvents, createEvent } from "../api/backend";
import AsyncStorage from "@react-native-async-storage/async-storage";

const formatDate = (value) => {
  if (!value) return "TBD";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function EventListScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("userRole").then((role) => {
      setIsAdmin(role === "admin");
    });
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchEvents();
      setEvents(res.events || []);
    } catch (err) {
      console.error("Failed to load events", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const openEvent = (event) => {
    navigation.navigate("EventDetails", {
      event: {
        id: event._id,
        name: event.title,
        description: event.description,
        date: event.date,
      },
    });
  };

  const handleCreateEvent = async () => {
    try {
      setCreating(true);
      const randomSuffix = Math.floor(Math.random() * 900) + 100;
      const payload = {
        title: `Campus Meetup #${randomSuffix}`,
        description: "Pop-up hangout to meet makers across labs and dorms.",
        date: new Date(Date.now() + randomSuffix * 60000).toISOString(),
      };
      await createEvent(payload);
      await loadEvents();
    } catch (err) {
      console.error("Event create error", err);
      alert("Couldn't create a new event right now.");
    } finally {
      setCreating(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEvent(item)}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSubtitle}>{formatDate(item.date)}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Join</Text>
        </View>
      </View>
      <Text style={styles.cardDesc}>{item.description || "Details coming soon."}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Events</Text>
        {isAdmin && (
          <TouchableOpacity
            style={[styles.createButton, creating && styles.disabledButton]}
            onPress={handleCreateEvent}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Add Event</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#fff" />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No events yet</Text>
              <Text style={styles.emptyText}>Create one to get your community talking.</Text>
            </View>
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 20 : 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  screenTitle: {
    color: "#F5F7FF",
    fontSize: 26,
    fontWeight: "700",
  },
  createButton: {
    backgroundColor: "rgba(91, 103, 241, 0.85)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  listContent: {
    paddingBottom: 80,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10194E",
  },
  cardSubtitle: {
    color: "#4E5876",
    marginTop: 4,
  },
  badge: {
    backgroundColor: "#5B67F1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  cardDesc: {
    color: "#4E5876",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 80,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyText: {
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    paddingHorizontal: 24,
  },
});

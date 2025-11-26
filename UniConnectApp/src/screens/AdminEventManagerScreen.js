import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchEvents, createEvent } from "../api/backend";

export default function AdminEventManagerScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
  });
  const [creating, setCreating] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchEvents();
      setEvents(res.events || []);
    } catch (err) {
      if (err?.code === "AUTH_EXPIRED") {
        Alert.alert("Session expired", "Please log in again.", [
          {
            text: "OK",
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{ name: "Login" }],
              }),
          },
        ]);
        return;
      }
      console.error("Admin events load error", err);
      Alert.alert("Error", "Unable to load events.");
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      Alert.alert("Missing info", "Event title is required.");
      return;
    }
    try {
      setCreating(true);
      await createEvent({
        title: form.title.trim(),
        description: form.description.trim(),
        date: form.date ? new Date(form.date).toISOString() : undefined,
      });
      setForm({ title: "", description: "", date: "" });
      await loadEvents();
    } catch (err) {
      if (err?.code === "AUTH_EXPIRED") {
        Alert.alert("Session expired", "Please log in again.", [
          {
            text: "OK",
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{ name: "Login" }],
              }),
          },
        ]);
        return;
      }
      console.error("Admin create event error", err);
      const message = err.response?.data?.error || "Unable to create event.";
      Alert.alert("Error", message);
    } finally {
      setCreating(false);
    }
  };

  const renderEvent = ({ item }) => (
    <View style={styles.eventCard}>
      <Text style={styles.eventTitle}>{item.title}</Text>
      <Text style={styles.eventDate}>
        {item.date ? new Date(item.date).toLocaleString() : "Date TBD"}
      </Text>
      <Text style={styles.eventDesc}>{item.description || "No description provided."}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Manage Events</Text>
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>Create new event</Text>
          <TextInput
            placeholder="Title"
            placeholderTextColor="#8A8FA6"
            style={styles.input}
            value={form.title}
            onChangeText={(text) => handleChange("title", text)}
          />
          <TextInput
            placeholder="Description"
            placeholderTextColor="#8A8FA6"
            style={[styles.input, styles.textarea]}
            multiline
            value={form.description}
            onChangeText={(text) => handleChange("description", text)}
          />
          <TextInput
            placeholder="Date (YYYY-MM-DD HH:mm)"
            placeholderTextColor="#8A8FA6"
            style={styles.input}
            value={form.date}
            onChangeText={(text) => handleChange("date", text)}
          />
          <TouchableOpacity
            style={[styles.primaryButton, creating && styles.disabledButton]}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Publish Event</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Active events</Text>
        {loading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item._id}
            renderItem={renderEvent}
            contentContainerStyle={{ paddingBottom: 80 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  container: {
    flex: 1,
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#F5F7FF",
    marginBottom: 16,
  },
  formCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#10194E",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D2D7F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#10194E",
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#5B67F1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  eventCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10194E",
  },
  eventDate: {
    color: "#4E5876",
    marginVertical: 4,
  },
  eventDesc: {
    color: "#4E5876",
  },
});

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { fetchEvents, fetchComplaints, logout } from "../api/backend";

export default function AdminDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    eventCount: 0,
    openComplaints: 0,
  });

  const handleAuthExpired = useCallback(() => {
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
  }, [navigation]);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const eventsRes = await fetchEvents();
      const eventCount = Array.isArray(eventsRes.events) ? eventsRes.events.length : 0;

      const complaintsRes = await fetchComplaints();
      const complaints = Array.isArray(complaintsRes.complaints) ? complaintsRes.complaints : [];

      const openComplaints = complaints.filter(
        (c) => c.status === "open" || c.status === "in_review"
      ).length;

      setStats({ eventCount, openComplaints });
    } catch (err) {
      if (err?.code === "AUTH_EXPIRED") {
        handleAuthExpired();
        return;
      }
      console.error("Failed to load admin stats", err);
    } finally {
      setLoading(false);
    }
  }, [handleAuthExpired]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const handleLogout = async () => {
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Admin Console</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#fff" style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Active Events</Text>
                <Text style={styles.statValue}>{stats.eventCount}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Open Complaints</Text>
                <Text style={styles.statValue}>{stats.openComplaints}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick Actions</Text>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate("AdminEvents")}
              >
                <Text style={styles.actionText}>Manage Events</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate("AdminComplaints")}
              >
                <Text style={styles.actionText}>Review Complaints</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
    padding: 24,
    paddingBottom: 60,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F5F7FF",
  },
  logoutButton: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "600",
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 18,
  },
  statLabel: {
    color: "#D0D6FF",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statValue: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 6,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 20,
    padding: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#10194E",
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: "#F1F3FF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  actionText: {
    color: "#5B67F1",
    fontWeight: "600",
    textAlign: "center",
  },
});

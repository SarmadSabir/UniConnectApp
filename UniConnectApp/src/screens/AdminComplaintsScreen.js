import React, { useState, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { fetchComplaints, updateComplaintStatus, deleteUserAccount } from "../api/backend";
import { useFocusEffect } from "@react-navigation/native";

const statusLabels = {
  open: "Open",
  in_review: "In review",
  resolved: "Resolved",
  rejected: "Rejected",
};

const statusOptions = ["open", "in_review", "resolved", "rejected"];

export default function AdminComplaintsScreen({ navigation }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);

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

  const loadComplaints = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchComplaints();
      setComplaints(res.complaints || []);
    } catch (err) {
      if (err?.code === "AUTH_EXPIRED") {
        handleAuthExpired();
        return;
      }
      console.error("Failed to fetch complaints", err);
      Alert.alert("Error", "Unable to load complaints.");
    } finally {
      setLoading(false);
    }
  }, [handleAuthExpired]);

  useFocusEffect(
    useCallback(() => {
      loadComplaints();
    }, [loadComplaints])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadComplaints();
    setRefreshing(false);
  }, [loadComplaints]);

  const handleStatusChange = async (id, status) => {
    try {
      setUpdating(id + status);
      await updateComplaintStatus(id, status);
      await loadComplaints();
    } catch (err) {
      if (err?.code === "AUTH_EXPIRED") {
        handleAuthExpired();
        return;
      }
      console.error("Failed to update complaint", err);
      Alert.alert("Error", err.response?.data?.error || "Unable to update status.");
    } finally {
      setUpdating(null);
    }
  };

  const requestDeleteUser = (complaint) => {
    if (!complaint?.reported_user?._id) return;
    Alert.alert(
      "Delete this user?",
      "This will remove the user account and resolve related complaints.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeleteUser(complaint.reported_user._id),
        },
      ]
    );
  };

  const handleDeleteUser = async (userId) => {
    try {
      setDeletingUser(userId);
      await deleteUserAccount(userId);
      await loadComplaints();
    } catch (err) {
      if (err?.code === "AUTH_EXPIRED") {
        handleAuthExpired();
        return;
      }
      console.error("Failed to delete user", err);
      Alert.alert("Error", err.response?.data?.error || "Unable to delete user.");
    } finally {
      setDeletingUser(null);
    }
  };

  const renderComplaint = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.type === "ban" ? "Ban Request" : item.type === "delete" ? "Deletion Request" : "General Report"}</Text>
      <Text style={styles.cardLabel}>
        Reporter: {item.requester?.name || "Unknown"} ({item.requester?.university_email || "N/A"})
      </Text>
      {item.reported_user ? (
        <Text style={styles.cardLabel}>
          Reported: {item.reported_user.name} ({item.reported_user.university_email})
        </Text>
      ) : item.reported_email ? (
        <Text style={styles.cardLabel}>Reported Email: {item.reported_email}</Text>
      ) : null}
      {item.reported_name && !item.reported_user ? (
        <Text style={styles.cardLabel}>Reported Name: {item.reported_name}</Text>
      ) : null}
      <Text style={styles.reason}>{item.reason}</Text>
      {item.message_text ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageLabel}>Message</Text>
          <Text style={styles.messageText}>{item.message_text}</Text>
        </View>
      ) : null}
      <View style={styles.statusRow}>
        {statusOptions.map((status) => (
          <TouchableOpacity
            key={`${item._id}-${status}`}
            style={[
              styles.statusButton,
              item.status === status && styles.statusButtonActive,
            ]}
            onPress={() => handleStatusChange(item._id, status)}
            disabled={updating !== null}
          >
            {updating === item._id + status ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                style={[
                  styles.statusButtonText,
                  item.status === status && styles.statusButtonTextActive,
                ]}
              >
                {statusLabels[status]}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {item.reported_user?._id ? (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => requestDeleteUser(item)}
          disabled={Boolean(deletingUser)}
        >
          {deletingUser === item.reported_user._id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete user</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Complaints & Requests</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#fff" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={complaints}
            keyExtractor={(item) => item._id}
            renderItem={renderComplaint}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No complaints</Text>
                <Text style={styles.emptyText}>Users have not submitted any reports yet.</Text>
              </View>
            }
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
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#F5F7FF",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10194E",
    marginBottom: 6,
  },
  cardLabel: {
    color: "#4E5876",
    marginBottom: 4,
  },
  reason: {
    color: "#10194E",
    marginTop: 8,
    marginBottom: 12,
  },
  messageBox: {
    backgroundColor: "#F4F6FF",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5B67F1",
    marginBottom: 4,
  },
  messageText: {
    color: "#10194E",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D2D7F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusButtonActive: {
    backgroundColor: "#5B67F1",
    borderColor: "#5B67F1",
  },
  statusButtonText: {
    color: "#4E5876",
    fontWeight: "600",
  },
  statusButtonTextActive: {
    color: "#fff",
  },
  deleteButton: {
    marginTop: 12,
    backgroundColor: "#D7263D",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyText: {
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
});

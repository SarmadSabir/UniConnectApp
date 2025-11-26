import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { submitComplaint } from "../api/backend";

const requestTypes = [
  { label: "Ban user", value: "ban" },
  { label: "Delete user", value: "delete" },
  { label: "General issue", value: "general" },
];

export default function ReportUserScreen({ navigation, route }) {
  const initialParams = route?.params || {};
  const [reportedEmail, setReportedEmail] = useState(initialParams.reportedEmail || "");
  const [reportedName, setReportedName] = useState(initialParams.reportedName || "");
  const [contextMessage, setContextMessage] = useState(initialParams.contextMessage || "");
  const [reason, setReason] = useState("");
  const [requestType, setRequestType] = useState("ban");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialParams.reportedEmail) {
      setReportedEmail((prev) => prev || initialParams.reportedEmail);
    }
    if (initialParams.reportedName) {
      setReportedName((prev) => prev || initialParams.reportedName);
    }
    if (initialParams.contextMessage) {
      setContextMessage((prev) => prev || initialParams.contextMessage);
    }
  }, [initialParams.reportedEmail, initialParams.reportedName, initialParams.contextMessage]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert("Missing info", "Please describe the issue.");
      return;
    }
    try {
      setSubmitting(true);
      await submitComplaint({
        reportedUserEmail: reportedEmail.trim(),
        reportedUserName: reportedName.trim(),
        reason: reason.trim(),
        requestType,
        messageText: contextMessage,
      });
      Alert.alert("Received", "Thanks! An admin will review this shortly.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
      setReportedEmail("");
      setReportedName("");
      setContextMessage("");
      setReason("");
      setRequestType("ban");
    } catch (err) {
      console.error("Report submit error", err);
      Alert.alert("Error", err.response?.data?.error || "Unable to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Report an issue</Text>
        <Text style={styles.subtitle}>
          Send a request to the admin team if you believe a user should be reviewed.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>User email (optional)</Text>
          <TextInput
            placeholder="student@university.edu"
            placeholderTextColor="#8A8FA6"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={reportedEmail}
            onChangeText={setReportedEmail}
          />

          <Text style={styles.label}>Request type</Text>
          <View style={styles.typeRow}>
            {requestTypes.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.typeButton,
                  requestType === option.value && styles.typeButtonActive,
                ]}
                onPress={() => setRequestType(option.value)}
              >
                <Text
                  style={[
                    styles.typeText,
                    requestType === option.value && styles.typeTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {reportedName ? (
            <Text style={styles.subLabel}>Reporting: {reportedName}</Text>
          ) : null}
          <Text style={styles.label}>Reason</Text>
          <TextInput
            placeholder="Describe what happened..."
            placeholderTextColor="#8A8FA6"
            style={[styles.input, styles.textarea]}
            multiline
            value={reason}
            onChangeText={setReason}
          />

          {contextMessage ? (
            <View style={styles.contextBox}>
              <Text style={styles.contextLabel}>Reported message</Text>
              <Text style={styles.contextText}>{contextMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>
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
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    padding: 18,
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
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10194E",
    marginBottom: 6,
  },
  subLabel: {
    fontSize: 13,
    color: "#4E5876",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D2D7F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    color: "#10194E",
    backgroundColor: "#F8F9FF",
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  typeRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 8,
    flexWrap: "wrap",
  },
  typeButton: {
    borderWidth: 1,
    borderColor: "#D2D7F9",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  typeButtonActive: {
    backgroundColor: "#5B67F1",
    borderColor: "#5B67F1",
  },
  typeText: {
    color: "#4E5876",
    fontWeight: "600",
  },
  typeTextActive: {
    color: "#fff",
  },
  contextBox: {
    backgroundColor: "rgba(91,103,241,0.1)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  contextLabel: {
    fontSize: 12,
    color: "#5B67F1",
    fontWeight: "600",
    marginBottom: 4,
  },
  contextText: {
    color: "#10194E",
  },
  primaryButton: {
    backgroundColor: "#5B67F1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
});

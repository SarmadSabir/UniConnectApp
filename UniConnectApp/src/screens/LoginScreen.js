import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { login } from "../api/backend";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Please provide both email and password.");
      return;
    }
    try {
      setLoading(true);
      const user = await login({ university_email: email.trim(), password });
      alert("Welcome back " + user.name);
      if (user.role === "admin") {
        navigation.replace("Admin");
      } else {
        navigation.replace("Main");
      }
    } catch (err) {
      console.error(err);
      alert("Login failed: " + (err.response?.data?.error || "Server error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.heroTitle}>UniConnect</Text>
        <Text style={styles.subtitle}>
          Find your teammates, co-founders, and study buddies.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <TextInput
            placeholder="University Email"
            placeholderTextColor="#8A8FA6"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <View style={styles.passwordField}>
            <TextInput
              placeholder="Password"
              placeholderTextColor="#8A8FA6"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              style={[styles.input, styles.passwordInput]}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setPasswordVisible((prev) => !prev)}
              accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={passwordVisible ? "eye-off" : "eye"}
                size={20}
                color="#5B67F1"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.replace("Signup")}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>
              New to UniConnect? <Text style={styles.linkText}>Create an account</Text>
            </Text>
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
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    textAlign: "center",
    color: "#bfc2caff",
    marginBottom: 28,
    fontSize: 16,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    color: "#10194E",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D2D7F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 16,
    color: "#10194E",
    backgroundColor: "#F8F9FF",
  },
  passwordField: {
    position: "relative",
    marginBottom: 14,
  },
  passwordInput: {
    paddingRight: 44,
    marginBottom: 0,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: "#5B67F1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  secondaryAction: {
    marginTop: 16,
  },
  secondaryActionText: {
    textAlign: "center",
    color: "#4E5876",
  },
  linkText: {
    color: "#5B67F1",
    fontWeight: "600",
  },
});

import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  View,
  ActivityIndicator,
} from "react-native";
import { signup } from "../api/backend";

const genderOptions = ["Male", "Female", "Other"];
const yearOptions = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];
const schoolOptions = ["Engineering", "Business", "Arts & Humanities", "Sciences", "Other"];
const programOptions = ["Undergraduate", "Masters", "PhD", "Exchange", "Certificate"];
const interestOptions = [
  "AI & ML",
  "Entrepreneurship",
  "Design",
  "Music",
  "Sports",
  "Gaming",
  "Volunteering",
  "Hackathons",
  "Research",
  "Travel",
];

const initialForm = {
  name: "",
  university_email: "",
  password: "",
  age: "",
  gender: genderOptions[0],
  year_classification: yearOptions[0],
  school: schoolOptions[0],
  program: programOptions[0],
  major: "",
};

export default function SignupScreen({ navigation }) {
  const [form, setForm] = useState(initialForm);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const handleChange = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const toggleDropdown = (key) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const toggleInterest = (interest) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((i) => i !== interest);
      }
      if (prev.length >= 5) return prev; // max 5 interests
      return [...prev, interest];
    });
  };

  const validateForm = () => {
    if (!form.name.trim()) return "Name is required.";
    if (!form.university_email.trim()) return "University email is required.";
    if (!form.password) return "Password is required.";
    const ageNumber = Number(form.age);
    if (Number.isNaN(ageNumber) || ageNumber <= 0) return "Please enter a valid age.";
    if (!form.major.trim()) return "Please share your major.";
    return null;
  };

  const handleSignup = async () => {
    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...form,
        age: Number(form.age),
        interests: selectedInterests,
      };
      const user = await signup(payload);
      alert("Signup successful! Welcome " + user.name);
      navigation.replace("Login");
    } catch (err) {
      console.error(err);
      alert("Signup failed: " + (err.response?.data?.error || "Server error"));
    } finally {
      setLoading(false);
    }
  };

  const renderDropdown = (label, value, options, key) => (
    <View style={styles.dropdownWrapper} key={key}>
      <TouchableOpacity style={styles.dropdownHeader} onPress={() => toggleDropdown(key)}>
        <Text style={value ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {value || label}
        </Text>
      </TouchableOpacity>
      {openDropdown === key && (
        <View style={styles.dropdownList}>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.dropdownOption}
              onPress={() => {
                handleChange(key, option);
                setOpenDropdown(null);
              }}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  value === option && styles.dropdownOptionSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Create your UniConnect profile</Text>
          <Text style={styles.subtitle}>
            We personalize matches based on your background, so give us a quick snapshot.
          </Text>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Basic info</Text>
            <TextInput
              placeholder="Full name"
              placeholderTextColor="#8A8FA6"
              style={styles.input}
              value={form.name}
              onChangeText={(text) => handleChange("name", text)}
            />
            <TextInput
              placeholder="University email"
              placeholderTextColor="#8A8FA6"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.university_email}
              onChangeText={(text) => handleChange("university_email", text)}
            />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#8A8FA6"
              style={styles.input}
              secureTextEntry
              value={form.password}
              onChangeText={(text) => handleChange("password", text)}
            />
            <TextInput
              placeholder="Age"
              placeholderTextColor="#8A8FA6"
              style={styles.input}
              keyboardType="numeric"
              value={form.age}
              onChangeText={(text) => handleChange("age", text)}
            />

            <Text style={styles.sectionLabel}>Gender</Text>
            <View style={styles.pillGroup}>
              {genderOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.pill,
                    form.gender === option && styles.pillSelected,
                  ]}
                  onPress={() => handleChange("gender", option)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      form.gender === option && styles.pillTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Year classification</Text>
            {renderDropdown("Select your year", form.year_classification, yearOptions, "year_classification")}

            <Text style={styles.sectionLabel}>School</Text>
            {renderDropdown("Select school", form.school, schoolOptions, "school")}

            <Text style={styles.sectionLabel}>Program</Text>
            {renderDropdown("Select program", form.program, programOptions, "program")}

            <Text style={styles.sectionLabel}>Major</Text>
            <TextInput
              placeholder="e.g. Computer Science"
              placeholderTextColor="#8A8FA6"
              style={styles.input}
              value={form.major}
              onChangeText={(text) => handleChange("major", text)}
            />

            <Text style={styles.sectionLabel}>Interests (pick up to 5)</Text>
            <TouchableOpacity
              style={styles.dropdownHeader}
              onPress={() => toggleDropdown("interests")}
            >
              <Text style={selectedInterests.length ? styles.dropdownValue : styles.dropdownPlaceholder}>
                {selectedInterests.length
                  ? selectedInterests.join(", ")
                  : "Select interests"}
              </Text>
            </TouchableOpacity>
            {openDropdown === "interests" && (
              <View style={styles.dropdownList}>
                {interestOptions.map((interest) => {
                  const selected = selectedInterests.includes(interest);
                  return (
                    <TouchableOpacity
                      key={interest}
                      style={[styles.dropdownOption, styles.interestOption]}
                      onPress={() => toggleInterest(interest)}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          selected && styles.dropdownOptionSelected,
                        ]}
                      >
                        {selected ? "✓ " : ""}{interest}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.replace("Login")}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryActionText}>
                Already registered? <Text style={styles.linkText}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  },
  container: {
    padding: 24,
    paddingBottom: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#10194E",
    marginBottom: 6,
  },
  subtitle: {
    color: "#4E5876",
    marginBottom: 16,
    fontSize: 15,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5B67F1",
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D2D7F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#10194E",
    backgroundColor: "#F8F9FF",
  },
  pillGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 6,
  },
  pill: {
    borderWidth: 1,
    borderColor: "#D2D7F9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    margin: 4,
    backgroundColor: "#fff",
  },
  pillSelected: {
    backgroundColor: "#5B67F1",
    borderColor: "#5B67F1",
  },
  pillText: {
    color: "#4E5876",
    fontWeight: "600",
  },
  pillTextSelected: {
    color: "#fff",
  },
  dropdownWrapper: {
    marginBottom: 6,
  },
  dropdownHeader: {
    borderWidth: 1,
    borderColor: "#D2D7F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F8F9FF",
    marginBottom: 6,
  },
  dropdownPlaceholder: {
    color: "#8A8FA6",
  },
  dropdownValue: {
    color: "#10194E",
    fontWeight: "600",
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: "#D2D7F9",
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 6,
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1FF",
  },
  dropdownOptionText: {
    color: "#4E5876",
  },
  dropdownOptionSelected: {
    color: "#5B67F1",
    fontWeight: "700",
  },
  interestOption: {
    borderBottomWidth: 0,
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
    marginTop: 12,
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

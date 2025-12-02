import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

const defaultEvent = {
  name: "Your UniConnect event",
  description: "Set how you want the algorithm to pair you up.",
  campus: "Campus-wide",
};

const defaultPreferences = {
  want_same_interests: false,
  want_different_major: false,
  want_same_major: false,
  want_same_gender: false,
  preferred_year_classifications: [],
};

const buildPreferenceState = (incoming) => {
  const merged = {
    ...defaultPreferences,
    ...(incoming || {}),
  };
  merged.preferred_year_classifications = Array.isArray(
    merged.preferred_year_classifications
  )
    ? merged.preferred_year_classifications.filter(Boolean)
    : merged.preferred_year_classifications
    ? [merged.preferred_year_classifications].filter(Boolean)
    : [];
  return merged;
};

const hasMeaningfulPreferenceValue = (value) => {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
};

const normalizePreferencePayload = (prefs) => {
  if (!prefs || typeof prefs !== "object") return null;
  const clean = {};
  Object.entries(prefs).forEach(([key, value]) => {
    if (!hasMeaningfulPreferenceValue(value)) return;
    if (Array.isArray(value)) {
      clean[key] = value.filter(Boolean);
      return;
    }
    if (typeof value === "boolean") {
      if (value) clean[key] = true;
      return;
    }
    clean[key] = value;
  });
  return Object.keys(clean).length ? clean : null;
};

const preferenceOptions = [
  {
    key: "want_same_interests",
    label: "Match with same interests",
    description: "Prioritize peers who obsess over the same clubs, hobbies, and side quests.",
    icon: "sparkles-outline",
  },
  {
    key: "want_different_major",
    label: "Match with different majors",
    description: "Mix disciplines to spark fresh ideas and unexpected collabs.",
    icon: "git-branch-outline",
    exclusiveWith: ["want_same_major"],
  },
  {
    key: "want_same_major",
    label: "Match with same major",
    description: "Pair up with classmates solving the same course load.",
    icon: "ribbon-outline",
    exclusiveWith: ["want_different_major"],
  },
  {
    key: "want_same_gender",
    label: "Match with same gender",
    description: "Opt-in if you collaborate best with peers who share your gender identity.",
    icon: "people-outline",
  },
];

const yearOptions = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];

export default function MatchPreferencesScreen({ route, navigation }) {
  const event = route?.params?.event || defaultEvent;
  const initialPrefs = useMemo(() => buildPreferenceState(route?.params?.prefs), [route?.params?.prefs]);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);

  useEffect(() => {
    if (route?.params?.prefs === undefined) return;
    setPrefs(buildPreferenceState(route.params.prefs));
  }, [route?.params?.prefs]);

  const displayEvent = useMemo(() => {
    const name = event?.name || event?.title || defaultEvent.name;
    const description = event?.description || defaultEvent.description;
    const campus = event?.campus || event?.location || defaultEvent.campus;
    return { name, description, campus };
  }, [event]);

  const activePreferenceCount = useMemo(
    () => Object.values(prefs).reduce((count, value) => count + (hasMeaningfulPreferenceValue(value) ? 1 : 0), 0),
    [prefs]
  );

  const togglePref = (key) => (value) =>
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      if (value) {
        const option = preferenceOptions.find((opt) => opt.key === key);
        if (option?.exclusiveWith?.length) {
          option.exclusiveWith.forEach((conflict) => {
            next[conflict] = false;
          });
        }
      }
      return next;
    });

  const toggleYearSelection = (year) =>
    setPrefs((prev) => {
      const current = new Set(prev.preferred_year_classifications || []);
      if (current.has(year)) {
        current.delete(year);
      } else {
        current.add(year);
      }
      return {
        ...prev,
        preferred_year_classifications: [...current],
      };
    });

  const clearYears = () =>
    setPrefs((prev) => ({
      ...prev,
      preferred_year_classifications: [],
    }));

  const handleConfirm = () => {
    const normalizedPrefs = normalizePreferencePayload(prefs);
    navigation.navigate("EventDetails", { event, prefs: normalizedPrefs });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#F5F7FF" />
          <Text style={styles.backText}>Back to event</Text>
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Dial in your vibe</Text>
          <Text style={styles.heroTitle}>{displayEvent.name}</Text>
          <Text style={styles.heroDesc}>{displayEvent.description}</Text>
          <View style={styles.heroChipRow}>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>Location</Text>
              <Text style={styles.heroChipValue}>{displayEvent.campus}</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>Preferences set</Text>
              <Text style={styles.heroChipValue}>
                {activePreferenceCount || "0"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Match preferences</Text>
          <Text style={styles.cardSubtitle}>
            Flip on the signals that matter. We blend them with your profile so matches feel intentional.
          </Text>

          {preferenceOptions.map((option) => (
            <View key={option.key} style={styles.preferenceRow}>
              <View style={styles.preferenceText}>
                <View style={styles.preferenceLabelRow}>
                  <Ionicons name={option.icon} size={16} color="#5B67F1" style={styles.preferenceIcon} />
                  <Text style={styles.preferenceLabel}>{option.label}</Text>
                </View>
                <Text style={styles.preferenceDescription}>{option.description}</Text>
              </View>
              <Switch
                trackColor={{ false: "rgba(15, 24, 64, 0.16)", true: "#8B93FF" }}
                thumbColor="#fff"
                ios_backgroundColor="rgba(15, 24, 64, 0.25)"
                value={prefs[option.key]}
                onValueChange={togglePref(option.key)}
              />
            </View>
          ))}

          <View style={styles.yearCard}>
            <View style={styles.yearHeader}>
              <View style={styles.yearHeaderText}>
                <Text style={styles.yearTitle}>Preferred year classification</Text>
                <Text style={styles.yearSubtitle}>Tell us which class years you click with most.</Text>
              </View>
              {prefs.preferred_year_classifications.length > 0 && (
                <TouchableOpacity onPress={clearYears}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            {prefs.preferred_year_classifications.length > 0 && (
              <View style={styles.selectedChipRow}>
                {prefs.preferred_year_classifications.map((year) => (
                  <TouchableOpacity
                    key={year}
                    onPress={() => toggleYearSelection(year)}
                    style={styles.selectedChip}
                  >
                    <Text style={styles.selectedChipText}>{year}</Text>
                    <Ionicons name="close-circle" size={16} color="#fff" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={styles.dropdownToggle}
              onPress={() => setYearPickerOpen((prev) => !prev)}
            >
              <Text style={styles.dropdownToggleText}>
                {yearPickerOpen ? "Hide year options" : "Select year preferences"}
              </Text>
              <Ionicons
                name={yearPickerOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color="#5B67F1"
              />
            </TouchableOpacity>
            {yearPickerOpen && (
              <View style={styles.dropdownOptions}>
                {yearOptions.map((year) => {
                  const selected = prefs.preferred_year_classifications.includes(year);
                  return (
                    <TouchableOpacity
                      key={year}
                      style={[styles.dropdownOption, selected && styles.dropdownOptionSelected]}
                      onPress={() => toggleYearSelection(year)}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          selected && styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {year}
                      </Text>
                      {selected && <Ionicons name="checkmark-circle" size={18} color="#fff" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.guideBox}>
            <Ionicons name="information-circle-outline" size={18} color="#4E5876" />
            <Text style={styles.guideText}>
              We'll still balance availability and team sizes. These settings just give us a louder hint.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleConfirm}>
            <Text style={styles.primaryButtonText}>Save & continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate("EventDetails", { event })}
          >
            <Text style={styles.linkButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
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
    paddingBottom: 40,
    paddingTop: 12,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backText: {
    marginLeft: 6,
    color: "#F5F7FF",
    fontSize: 14,
    fontWeight: "600",
  },
  heroCard: {
    backgroundColor: "rgba(91, 103, 241, 0.92)",
    borderRadius: 26,
    padding: 22,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroDesc: {
    color: "#F3F4FF",
    fontSize: 15,
    marginBottom: 18,
  },
  heroChipRow: {
    flexDirection: "row",
    gap: 12,
  },
  heroChip: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  heroChipLabel: {
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  heroChipValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F1840",
    marginBottom: 4,
  },
  cardSubtitle: {
    color: "#4E5876",
    fontSize: 15,
    marginBottom: 20,
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F4F5FF",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  preferenceText: {
    flex: 1,
    paddingRight: 14,
  },
  preferenceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  preferenceIcon: {
    marginRight: 6,
  },
  preferenceLabel: {
    fontSize: 16,
    color: "#0F1840",
    fontWeight: "700",
  },
  preferenceDescription: {
    color: "#525577",
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  yearCard: {
    backgroundColor: "#EEF0FF",
    borderRadius: 18,
    padding: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  yearHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  yearHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  yearTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F1840",
  },
  yearSubtitle: {
    marginTop: 4,
    color: "#4E5876",
    fontSize: 13,
    lineHeight: 18,
  },
  clearButtonText: {
    color: "#5B67F1",
    fontWeight: "600",
  },
  selectedChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#5B67F1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  selectedChipText: {
    color: "#fff",
    fontWeight: "600",
  },
  dropdownToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(91,103,241,0.2)",
  },
  dropdownToggleText: {
    color: "#0F1840",
    fontWeight: "600",
  },
  dropdownOptions: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(91,103,241,0.15)",
  },
  dropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dropdownOptionSelected: {
    backgroundColor: "#5B67F1",
  },
  dropdownOptionText: {
    color: "#0F1840",
    fontSize: 15,
    fontWeight: "600",
  },
  dropdownOptionTextSelected: {
    color: "#fff",
  },
  guideBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 24, 64, 0.06)",
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 18,
    gap: 8,
  },
  guideText: {
    color: "#4E5876",
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: "#5B67F1",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 6,
  },
  linkButtonText: {
    color: "#4E5876",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});

import React, { useState } from "react";
import { View, Text, Switch, Button, StyleSheet } from "react-native";

export default function MatchPreferencesScreen({ route, navigation }) {
    const { event } = route.params;
    const [prefs, setPrefs] = useState({
        want_same_interests: false,
        want_different_major: false,
    });

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Match Preferences</Text>

            <View style={styles.row}>
                <Text>Match with same interests?</Text>
                <Switch
                    value={prefs.want_same_interests}
                    onValueChange={(v) => setPrefs({...prefs, want_same_interests: v})}
                />
            </View>

            <View style={styles.row}>
                <Text>Match with different majors?</Text>
                <Switch
                     value={prefs.want_different_major}
                    onValueChange={(v) => setPrefs({...prefs, want_different_major: v})}
                />
            </View>

            <Button 
                title="Confirm"
                onPress={() => navigation.navigate("EventDetails", { event, prefs })}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20},
    title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
    row: {flexDirection: "row", justifyContent: "space-between", marginVertical: 8 }
}) 
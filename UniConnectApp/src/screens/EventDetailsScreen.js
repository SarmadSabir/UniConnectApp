import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from "react-native";
import { requestMatch } from '../api/backend';

export default function EventDetailsScreen({ route, navigation }) {
    const { event } = route.params;
    const [loading, setLoading] = userState(false);
    const [group, setGroup] = userState(null);

    const handleGoSolo = async (mode = "auto", preferences = {}) => {
        setLoading(true);
        try {
            const users = [
                {
                    user_id: "123",
                    age: 22,
                    year_classification: "Junior",
                    school: "SSE",
                    program: "BSc Computer Science",
                    major: "CS",
                    gender: "Male",
                    interets: ["Gaming", "Music", "Coding / Programming"]
                },
            ];
            const res = await requestMatch(event.id, mode, preferences, users);
            setGroup(res.data?.group || []);
            navigation.navigate("GroupChat", { group: res.data.group });
        } catch (err) {
            console.error(err);
            alert("Failed to get match");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={style.container}>
            <Text style={StyleSheet.title}>{event.name}</Text>
            <Text>{event.description}</Text>
            <Button title="Go Solo (Let AI Decide)" onPress={}
        </View>
    )
}
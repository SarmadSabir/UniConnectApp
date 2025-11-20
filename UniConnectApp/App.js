import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AppNavigator from "./src/navigation/AppNavigator";

const backgroundSource = require("./assets/background.jpg");

export default function App() {
  return (
    <SafeAreaProvider>
      <ImageBackground source={backgroundSource} style={styles.background} resizeMode="cover">
        <StatusBar style="light" />
        <View style={styles.overlay}>
          <AppNavigator />
        </View>
      </ImageBackground>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(4, 9, 31, 0.65)",
  },
});

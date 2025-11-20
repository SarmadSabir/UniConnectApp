import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";

import EventDetailsScreen from "../screens/EventDetailsScreen";
import MatchPreferencesScreen from "../screens/MatchPreferencesScreen";
import EventListScreen from "../screens/EventListScreen";
import GroupChatScreen from "../screens/GroupChatScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import ChatListScreen from "../screens/ChatListScreen";

const RootStack = createStackNavigator();
const EventStack = createStackNavigator();
const ChatStack = createStackNavigator();
const Tab = createBottomTabNavigator();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
  },
};

function EventsNavigator() {
  return (
    <EventStack.Navigator screenOptions={{ headerShown: false }}>
      <EventStack.Screen name="EventDetails" component={EventDetailsScreen} />
      <EventStack.Screen name="MatchPreferences" component={MatchPreferencesScreen} />
      <EventStack.Screen name="EventList" component={EventListScreen} />
    </EventStack.Navigator>
  );
}

function ChatsNavigator() {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="ChatList" component={ChatListScreen} />
    </ChatStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, focused }) => {
          let icon = "calendar-outline";
          if (route.name === "EventsTab") {
            icon = focused ? "calendar" : "calendar-outline";
          } else if (route.name === "ChatsTab") {
            icon = focused ? "chatbubble" : "chatbubble-outline";
          }
          return <Ionicons name={icon} size={22} color={color} />;
        },
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "rgba(255,255,255,0.7)",
        tabBarStyle: {
          backgroundColor: "rgba(7, 14, 35, 0.9)",
          borderTopWidth: 0,
          height: 72,
          paddingBottom: 12,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      })}
    >
      <Tab.Screen name="EventsTab" component={EventsNavigator} options={{ title: "Events" }} />
      <Tab.Screen name="ChatsTab" component={ChatsNavigator} options={{ title: "Chats" }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Login" component={LoginScreen} />
        <RootStack.Screen name="Signup" component={SignupScreen} />
        <RootStack.Screen name="Main" component={MainTabs} />
        <RootStack.Screen name="GroupChat" component={GroupChatScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

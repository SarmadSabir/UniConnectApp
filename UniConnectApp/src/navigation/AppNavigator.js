import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";

import EventDetailsScreen from "../screens/EventDetailsScreen";
import MatchPreferencesScreen from "../screens/MatchPreferencesScreen";
import EventListScreen from "../screens/EventListScreen";
import GroupChatScreen from "../screens/GroupChatScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import ChatListScreen from "../screens/ChatListScreen";
import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import AdminEventManagerScreen from "../screens/AdminEventManagerScreen";
import AdminComplaintsScreen from "../screens/AdminComplaintsScreen";
import ReportUserScreen from "../screens/ReportUserScreen";

const RootStack = createStackNavigator();
const EventStack = createStackNavigator();
const ChatStack = createStackNavigator();
const AdminStack = createStackNavigator();
const Tab = createBottomTabNavigator();

const APP_BACKGROUND = "#050A1F";

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: APP_BACKGROUND,
  },
};

const stackScreenOptions = {
  headerShown: false,
  animationEnabled: true,
  detachPreviousScreen: true,
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  cardStyle: { backgroundColor: APP_BACKGROUND },
};

function EventsNavigator() {
  return (
    <EventStack.Navigator screenOptions={stackScreenOptions}>
      <EventStack.Screen name="EventDetails" component={EventDetailsScreen} />
      <EventStack.Screen name="MatchPreferences" component={MatchPreferencesScreen} />
      <EventStack.Screen name="EventList" component={EventListScreen} />
      <EventStack.Screen name="GroupChat" component={GroupChatScreen} />
      <EventStack.Screen name="ReportUser" component={ReportUserScreen} />
    </EventStack.Navigator>
  );
}

function ChatsNavigator() {
  return (
    <ChatStack.Navigator screenOptions={stackScreenOptions}>
      <ChatStack.Screen name="ChatList" component={ChatListScreen} />
      <ChatStack.Screen name="ReportUser" component={ReportUserScreen} />
      <ChatStack.Screen name="GroupChat" component={GroupChatScreen} />
    </ChatStack.Navigator>
  );
}

function AdminNavigator() {
  return (
    <AdminStack.Navigator screenOptions={stackScreenOptions}>
      <AdminStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <AdminStack.Screen name="AdminEvents" component={AdminEventManagerScreen} />
      <AdminStack.Screen name="AdminComplaints" component={AdminComplaintsScreen} />
      <AdminStack.Screen name="GroupChat" component={GroupChatScreen} />
    </AdminStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: APP_BACKGROUND }}
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
      <RootStack.Navigator initialRouteName="Login" screenOptions={stackScreenOptions}>
        <RootStack.Screen name="Login" component={LoginScreen} />
        <RootStack.Screen name="Signup" component={SignupScreen} />
        <RootStack.Screen name="Main" component={MainTabs} />
        <RootStack.Screen name="Admin" component={AdminNavigator} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

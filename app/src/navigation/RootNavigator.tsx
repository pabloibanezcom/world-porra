import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import MatchListScreen from '../screens/MatchListScreen';
import MatchDetailScreen from '../screens/MatchDetailScreen';
import LeaguesScreen from '../screens/LeaguesScreen';
import CreateLeagueScreen from '../screens/CreateLeagueScreen';
import JoinLeagueScreen from '../screens/JoinLeagueScreen';
import LeagueDetailScreen from '../screens/LeagueDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MatchesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.primary }}>
      <Stack.Screen name="MatchList" component={MatchListScreen} options={{ title: 'Matches' }} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ title: 'Match' }} />
    </Stack.Navigator>
  );
}

function LeaguesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.primary }}>
      <Stack.Screen name="LeaguesList" component={LeaguesScreen} options={{ title: 'Leagues' }} />
      <Stack.Screen name="CreateLeague" component={CreateLeagueScreen} options={{ title: 'Create League' }} />
      <Stack.Screen name="JoinLeague" component={JoinLeagueScreen} options={{ title: 'Join League' }} />
      <Stack.Screen name="LeagueDetail" component={LeagueDetailScreen} options={{ title: 'League' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Matches') iconName = focused ? 'football' : 'football-outline';
          else if (route.name === 'Leagues') iconName = focused ? 'trophy' : 'trophy-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Matches" component={MatchesStack} />
      <Tab.Screen name="Leagues" component={LeaguesStack} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, isLoading, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

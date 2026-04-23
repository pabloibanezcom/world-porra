import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { colors, fonts } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import LeaguesScreen from '../screens/LeaguesScreen';
import PicksScreen from '../screens/PicksScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CreateLeagueScreen from '../screens/CreateLeagueScreen';
import JoinLeagueScreen from '../screens/JoinLeagueScreen';
import LeagueDetailScreen from '../screens/LeagueDetailScreen';
import MatchDetailScreen from '../screens/MatchDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 78,
          paddingTop: 10,
          paddingBottom: 16,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.dim,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' as const, fontFamily: fonts.bodyMedium },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Leagues') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Predictions') iconName = focused ? 'football' : 'football-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home', tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Leagues"
        component={LeaguesScreen}
        options={{ title: 'Leagues', tabBarLabel: 'Leagues' }}
      />
      <Tab.Screen
        name="Predictions"
        component={PicksScreen}
        options={{ title: 'Predictions', tabBarLabel: 'Predictions' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile', tabBarLabel: 'Profile' }}
      />
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="CreateLeague"
              component={CreateLeagueScreen}
              options={{ headerShown: true, title: 'Create League' }}
            />
            <Stack.Screen
              name="JoinLeague"
              component={JoinLeagueScreen}
              options={{ headerShown: true, title: 'Join League' }}
            />
            <Stack.Screen
              name="LeagueDetail"
              component={LeagueDetailScreen}
              options={{ headerShown: true, title: 'League' }}
            />
            <Stack.Screen
              name="MatchDetail"
              component={MatchDetailScreen}
              options={{ headerShown: true, title: 'Match' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { colors, fonts } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import LeaguesScreen from '../screens/LeaguesScreen';
import PicksScreen from '../screens/PicksScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RulesScreen from '../screens/RulesScreen';
import CreateLeagueScreen from '../screens/CreateLeagueScreen';
import JoinLeagueScreen from '../screens/JoinLeagueScreen';
import LeagueDetailScreen from '../screens/LeagueDetailScreen';
import MatchDetailScreen from '../screens/MatchDetailScreen';
import MemberScreen from '../screens/MemberScreen';
import { useI18n } from '../i18n';

const Stack = createNativeStackNavigator();
const LeaguesStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function LeaguesStackNavigator() {
  return (
    <LeaguesStack.Navigator screenOptions={{ headerShown: false }}>
      <LeaguesStack.Screen name="LeagueList" component={LeaguesScreen} />
      <LeaguesStack.Screen name="LeagueDetail" component={LeagueDetailScreen} />
    </LeaguesStack.Navigator>
  );
}

function MainTabs() {
  const { t } = useI18n();

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
        animation: 'none',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Leagues') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Predictions') iconName = focused ? 'football' : 'football-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          else if (route.name === 'Rules') iconName = focused ? 'star' : 'star-outline';
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('nav.home'), tabBarLabel: t('nav.home') }}
      />
      <Tab.Screen
        name="Leagues"
        component={LeaguesStackNavigator}
        options={{ title: t('nav.leagues'), tabBarLabel: t('nav.leagues') }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Leagues', { screen: 'LeagueList' });
          },
        })}
      />
      <Tab.Screen
        name="Predictions"
        component={PicksScreen}
        options={{ title: t('nav.predictions'), tabBarLabel: t('nav.predictions') }}
      />
      <Tab.Screen
        name="Rules"
        component={RulesScreen}
        options={{ title: t('nav.rules'), tabBarLabel: t('nav.rules') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('nav.profile'), tabBarLabel: t('nav.profile') }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, isLoading, restoreSession } = useAuthStore();
  const { t } = useI18n();

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
              options={{ headerShown: true, title: t('nav.createLeague'), presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="JoinLeague"
              component={JoinLeagueScreen}
              options={{ headerShown: true, title: t('nav.joinLeague'), presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="MatchDetail"
              component={MatchDetailScreen}
              options={{ headerShown: true, title: t('nav.match'), animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="MemberScreen"
              component={MemberScreen}
              options={{ headerShown: false, animation: 'slide_from_right' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

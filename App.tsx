import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ImageBackground } from 'react-native';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import CircleScreen from './src/screens/CircleScreen';
import SessionScreen from './src/screens/SessionScreen';
import SafetyFeedScreen from './src/screens/SafetyFeedScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import WatchingScreen from './src/screens/WatchingScreen';
import LiveMapScreen from './src/screens/LiveMapScreen';
import SOSActiveScreen from './src/screens/SOSActiveScreen';
import SOSListenScreen from './src/screens/SOSListenScreen';
import { colors } from './src/theme/theme';

const Stack = createNativeStackNavigator();

function LoadingScreen() {
  return (
    <ImageBackground
      source={require('./assets/bg_home.png')}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      resizeMode="cover"
    />
  );
}

function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontFamily: 'Poppins_700Bold', fontSize: 18 },
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Circle" component={CircleScreen} options={{ headerShown: true, title: 'Trusted Circle' }} />
          <Stack.Screen name="Session" component={SessionScreen} options={{ headerShown: true, title: 'Safety Session' }} />
          <Stack.Screen name="SafetyFeed" component={SafetyFeedScreen} options={{ headerShown: true, title: 'Safety Updates' }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: true, title: 'Edit Profile' }} />
          <Stack.Screen name="Watching" component={WatchingScreen} options={{ headerShown: true, title: 'Watching' }} />
          <Stack.Screen name="LiveMap" component={LiveMapScreen} options={{ headerShown: true, title: 'Live Location' }} />
          <Stack.Screen name="SOSActive" component={SOSActiveScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="SOSListen" component={SOSListenScreen} options={{ headerShown: true, title: 'SOS Recording' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: true, title: 'Reset Password' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Fredoka_700Bold,
  });

  if (!fontsLoaded) {
    return <LoadingScreen />;
  }

  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
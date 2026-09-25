import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore - getReactNativePersistence exists at runtime but is missing from some type defs
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
    apiKey: "AIzaSyBgmJqlzOtU4AEjjReqtUYcOpPECZs60Ew",
    authDomain: "circlewatch-dbdc6.firebaseapp.com",
    projectId: "circlewatch-dbdc6",
    storageBucket: "circlewatch-dbdc6.firebasestorage.app",
    messagingSenderId: "362827184359",
    appId: "1:362827184359:web:ab7d50c7e1e8b6f387ca42",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
    });

export const db = getFirestore(app);
export default app;
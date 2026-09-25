import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    sendEmailVerification,
    updateProfile,
    User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { registerForPushNotificationsAsync } from '../utils/notifications';

type AuthContextType = {
    user: User | null;
    initializing: boolean;
    signUp: (email: string, password: string, displayName: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    logOut: () => Promise<void>;
    updateDisplayName: (newName: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [initializing, setInitializing] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            setInitializing(false);

            if (firebaseUser) {
                try {
                    const token = await registerForPushNotificationsAsync();
                    if (token) {
                        await setDoc(doc(db, 'pushTokens', firebaseUser.uid), { token, updatedAt: serverTimestamp() });
                    }
                } catch (err) {
                    console.log('Push registration failed', err);
                }
            }
        });
        return unsubscribe;
    }, []);

    const signUp = async (email: string, password: string, displayName: string) => {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(credential.user);

        const normalizedEmail = email.trim().toLowerCase();

        await setDoc(doc(db, 'users', credential.user.uid), {
            displayName,
            email: normalizedEmail,
            trustedCircle: [],
            createdAt: serverTimestamp(),
        });

        await setDoc(doc(db, 'emailIndex', normalizedEmail), { uid: credential.user.uid, displayName });
    };

    const signIn = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const logOut = async () => {
        await firebaseSignOut(auth);
    };

    const updateDisplayName = async (newName: string) => {
        const trimmedName = newName.trim();
        if (!trimmedName) {
            throw new Error('Name cannot be empty.');
        }
        if (!auth.currentUser) {
            throw new Error('You need to be signed in to do that.');
        }

        // 1. Update the name on the Firebase Auth account itself.
        await updateProfile(auth.currentUser, { displayName: trimmedName });

        // 2. Keep the Firestore user profile doc in sync.
        await setDoc(
            doc(db, 'users', auth.currentUser.uid),
            { displayName: trimmedName },
            { merge: true }
        );

        // 3. Keep the emailIndex doc in sync, so anyone who adds this person
        //    to their Trusted Circle by email sees the updated name.
        const normalizedEmail = auth.currentUser.email?.trim().toLowerCase();
        if (normalizedEmail) {
            await setDoc(
                doc(db, 'emailIndex', normalizedEmail),
                { uid: auth.currentUser.uid, displayName: trimmedName },
                { merge: true }
            );
        }

        // updateProfile() mutates auth.currentUser in place but Firebase does not
        // re-fire onAuthStateChanged for profile-only changes, and React won't
        // re-render off the same object reference — so we clone it into state
        // ourselves to make the new name show up immediately across the app.
        setUser({ ...auth.currentUser } as User);
    };

    return (
        <AuthContext.Provider value={{ user, initializing, signUp, signIn, logOut, updateDisplayName }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}
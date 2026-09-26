import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator, Keyboard, TouchableWithoutFeedback, SafeAreaView, ImageBackground } from 'react-native';
import * as Location from 'expo-location';
import { addDoc, collection, doc, updateDoc, onSnapshot, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { sendPushAlert } from '../utils/notifications';
import { colors, spacing, radius, shadow, typography } from '../theme/theme';

type SessionData = {
    ownerId: string;
    ownerName: string;
    circleUserIds: string[];
    status: 'active' | 'completed' | 'sos' | 'missed';
    expectedArrivalAt: Timestamp;
    lastLocation?: { latitude: number; longitude: number };
    alertSent?: boolean;
};

export default function SessionScreen() {
    const { user } = useAuth();
    const [minutes, setMinutes] = useState('15');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [session, setSession] = useState<SessionData | null>(null);
    const [starting, setStarting] = useState(false);
    const watchRef = useRef<Location.LocationSubscription | null>(null);
    const missedAlertShownRef = useRef(false);

    useEffect(() => {
        if (!sessionId) return;
        const unsubscribe = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
            setSession(snap.data() as SessionData);
        });
        return unsubscribe;
    }, [sessionId]);

    useEffect(() => {
        return () => {
            watchRef.current?.remove();
        };
    }, []);

    // Missed-check-in detection and the circle alert itself now happen
    // server-side (scripts/check-missed-sessions.js, on a 5-minute GitHub
    // Actions schedule) so they still fire even if this phone loses signal,
    // the battery dies, or the app gets backgrounded/killed. This effect
    // just shows a heads-up here if the app happens to still be open when
    // the server flips the status.
    useEffect(() => {
        if (session?.status === 'missed' && !missedAlertShownRef.current) {
            missedAlertShownRef.current = true;
            Alert.alert('Circle notified', "You've missed your check-in window. Your trusted circle has been alerted with your last known location.");
        }
    }, [session?.status]);

    const notifyCircleSessionStarted = async (circleUserIds: string[], ownerName: string, newSessionId: string) => {
        try {
            const tokens: string[] = [];
            for (const uid of circleUserIds) {
                const tokenSnap = await getDoc(doc(db, 'pushTokens', uid));
                const token = tokenSnap.data()?.token;
                if (token) tokens.push(token);
            }

            if (tokens.length === 0) return;

            await sendPushAlert(
                tokens,
                'CircleWatch',
                `${ownerName} started a safety session. Open Watching to see their live location.`,
                { sessionId: newSessionId, type: 'session-started' }
            );
        } catch (error) {
            console.log('Failed to notify circle of session start', error);
        }
    };

    const startSession = async () => {
        if (!user) return;
        const mins = parseInt(minutes, 10);
        if (!mins || mins <= 0) {
            Alert.alert('Invalid time', 'Enter how many minutes until you expect to arrive.');
            return;
        }

        setStarting(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Location needed', 'CircleWatch needs location access to share your route with your circle.');
                return;
            }

            const position = await Location.getCurrentPositionAsync({});
            const userDocSnap = await getDoc(doc(db, 'users', user.uid));
            const trustedCircle = (userDocSnap.data()?.trustedCircle ?? []) as { uid: string }[];
            const circleUserIds = trustedCircle.map((m) => m.uid);
            const ownerName = user.displayName ?? user.email ?? 'Someone in your circle';

            const expectedArrivalAt = Timestamp.fromDate(new Date(Date.now() + mins * 60 * 1000));

            const docRef = await addDoc(collection(db, 'sessions'), {
                ownerId: user.uid,
                ownerName,
                circleUserIds,
                status: 'active',
                alertSent: false,
                startedAt: serverTimestamp(),
                expectedArrivalAt,
                lastLocation: { latitude: position.coords.latitude, longitude: position.coords.longitude },
            });
            setSessionId(docRef.id);

            notifyCircleSessionStarted(circleUserIds, ownerName, docRef.id);

            watchRef.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 20 },
                (loc) => {
                    updateDoc(doc(db, 'sessions', docRef.id), {
                        lastLocation: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
                        lastUpdatedAt: serverTimestamp(),
                    });
                }
            );
        } catch (error: any) {
            Alert.alert('Could not start session', error.message ?? 'Something went wrong.');
        } finally {
            setStarting(false);
        }
    };

    const endSession = async () => {
        if (!sessionId) return;
        await updateDoc(doc(db, 'sessions', sessionId), { status: 'completed' });
        watchRef.current?.remove();
        watchRef.current = null;
        setSessionId(null);
        setSession(null);
    };

    if (sessionId && session) {
        const arrival = session.expectedArrivalAt?.toDate?.();
        const missed = session.status === 'missed';
        return (
            <ImageBackground source={require('../../assets/bg_home.png')} style={styles.gradient} resizeMode="cover">
                <SafeAreaView style={styles.centerContainer}>
                    <View style={styles.card}>
                        <View style={[styles.statusBadge, missed ? styles.statusBadgeMissed : styles.statusBadgeActive]}>
                            <Text style={styles.statusBadgeText}>{missed ? '⚠ Missed check-in' : '● Live'}</Text>
                        </View>
                        <Text style={styles.title}>{missed ? 'Circle Notified' : 'Session Active'}</Text>
                        <Text style={styles.subtitle}>
                            {missed ? 'You missed your check-in window. Your circle has been alerted.' : 'Your circle can see your live location.'}
                            {'\n'}Expected arrival: {arrival ? arrival.toLocaleTimeString() : '—'}
                        </Text>
                        <TouchableOpacity style={styles.safeButton} onPress={endSession}>
                            <Text style={styles.buttonText}>I'm Safe — End Session</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </ImageBackground>
        );
    }

    return (
        <ImageBackground source={require('../../assets/bg_home.png')} style={styles.gradient} resizeMode="cover">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <SafeAreaView style={styles.centerContainer}>
                    <View style={styles.card}>
                        <Text style={styles.title}>Start a Safety Session</Text>
                        <Text style={styles.subtitle}>Your trusted circle will see your live location until you arrive.</Text>
                        <Text style={styles.label}>Expected arrival, in minutes from now:</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="number-pad"
                            value={minutes}
                            onChangeText={setMinutes}
                        />
                        <TouchableOpacity style={styles.button} onPress={startSession} disabled={starting}>
                            {starting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Start Session</Text>}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </TouchableWithoutFeedback>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    centerContainer: { flex: 1, justifyContent: 'center', padding: spacing.xl },
    card: {
        backgroundColor: colors.cardBackground,
        borderRadius: radius.xl,
        padding: spacing.xl,
        ...shadow.card,
    },
    statusBadge: {
        alignSelf: 'center',
        borderRadius: radius.pill,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    statusBadgeActive: { backgroundColor: 'rgba(63, 214, 140, 0.18)' },
    statusBadgeMissed: { backgroundColor: 'rgba(255, 59, 92, 0.15)' },
    statusBadgeText: { fontWeight: '700', fontSize: 13, color: colors.textDark },
    title: { ...typography.heading, textAlign: 'center', marginBottom: spacing.xs },
    subtitle: { ...typography.subheading, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
    label: { color: colors.textMuted, marginBottom: spacing.sm, fontSize: 14, fontWeight: '600' },
    input: {
        backgroundColor: colors.inputBackground,
        color: colors.textDark,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.lg,
        fontSize: 18,
        textAlign: 'center',
        fontWeight: '700',
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: radius.pill,
        padding: spacing.md,
        alignItems: 'center',
        ...shadow.button,
    },
    safeButton: {
        backgroundColor: colors.success,
        borderRadius: radius.pill,
        padding: spacing.md,
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    buttonText: { ...typography.button },
});
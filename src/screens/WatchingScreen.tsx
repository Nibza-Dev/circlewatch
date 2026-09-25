import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius, shadow, typography } from '../theme/theme';

type WatchedSession = {
    kind: 'session';
    id: string;
    ownerName: string;
    status: 'active' | 'missed' | 'completed' | 'sos';
    expectedArrivalAt?: Timestamp;
};

type WatchedSos = {
    kind: 'sos';
    id: string;
    ownerName: string;
    status: 'recording' | 'stopped';
};

type WatchedItem = WatchedSession | WatchedSos;

type Props = NativeStackScreenProps<any, 'Watching'>;

export default function WatchingScreen({ navigation }: Props) {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<WatchedSession[]>([]);
    const [sosRecordings, setSosRecordings] = useState<WatchedSos[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const sessionsQuery = query(
            collection(db, 'sessions'),
            where('circleUserIds', 'array-contains', user.uid),
            where('status', 'in', ['active', 'missed'])
        );
        const unsubSessions = onSnapshot(
            sessionsQuery,
            (snapshot) => {
                setSessions(
                    snapshot.docs.map((d) => ({ kind: 'session' as const, id: d.id, ...(d.data() as Omit<WatchedSession, 'id' | 'kind'>) }))
                );
                setLoading(false);
            },
            (error) => {
                console.log('Sessions watch query failed', error);
                setLoading(false);
            }
        );

        const sosQuery = query(
            collection(db, 'sosRecordings'),
            where('circleUserIds', 'array-contains', user.uid),
            where('status', 'in', ['recording', 'stopped'])
        );
        const unsubSos = onSnapshot(
            sosQuery,
            (snapshot) => {
                setSosRecordings(
                    snapshot.docs.map((d) => ({ kind: 'sos' as const, id: d.id, ...(d.data() as Omit<WatchedSos, 'id' | 'kind'>) }))
                );
            },
            (error) => {
                console.log('SOS watch query failed', error);
            }
        );

        return () => {
            unsubSessions();
            unsubSos();
        };
    }, [user]);

    if (loading) {
        return (
            <ImageBackground source={require('../../assets/bg_home.png')} style={styles.center} resizeMode="cover">
                <ActivityIndicator size="large" color={colors.white} />
            </ImageBackground>
        );
    }

    const combined: WatchedItem[] = [...sosRecordings, ...sessions];

    return (
        <ImageBackground source={require('../../assets/bg_home.png')} style={styles.gradient} resizeMode="cover">
            <SafeAreaView style={styles.container}>
                <Text style={styles.subtitle}>People in your circle who are currently on a safety session or SOS.</Text>

                <FlatList
                    data={combined}
                    keyExtractor={(item) => `${item.kind}-${item.id}`}
                    contentContainerStyle={{ paddingBottom: spacing.xl, paddingTop: spacing.xs }}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="eye-outline" size={40} color={colors.white} style={{ opacity: 0.6 }} />
                            <Text style={styles.empty}>No one is out right now.{'\n'}You'll see it here the moment someone starts a session or sends an SOS.</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        if (item.kind === 'sos') {
                            const recording = item.status === 'recording';
                            return (
                                <TouchableOpacity onPress={() => navigation.navigate('SOSListen', { sosId: item.id })}>
                                    <BlurView intensity={60} tint="light" style={[styles.sessionCard, styles.sosCard]}>
                                        <Ionicons name="mic" size={20} color={colors.danger} style={{ marginRight: spacing.md }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.ownerName}>{item.ownerName}</Text>
                                            <Text style={[styles.statusText, styles.sosStatusText]}>
                                                {recording ? '🔴 SOS active — recording live' : 'SOS recording ended — tap to listen'}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                                    </BlurView>
                                </TouchableOpacity>
                            );
                        }

                        const missed = item.status === 'missed';
                        const arrival = item.expectedArrivalAt?.toDate?.();
                        return (
                            <TouchableOpacity onPress={() => navigation.navigate('LiveMap', { sessionId: item.id })}>
                                <BlurView intensity={60} tint="light" style={styles.sessionCard}>
                                    <View style={[styles.statusDot, missed ? styles.statusDotMissed : styles.statusDotActive]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.ownerName}>{item.ownerName}</Text>
                                        <Text style={styles.statusText}>
                                            {missed
                                                ? 'Missed check-in — needs attention'
                                                : `Expected by ${arrival ? arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}`}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                                </BlurView>
                            </TouchableOpacity>
                        );
                    }}
                />
            </SafeAreaView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl },
    subtitle: { fontSize: 14, color: colors.white, opacity: 0.85, lineHeight: 20, marginBottom: spacing.lg },
    emptyWrap: { alignItems: 'center', marginTop: 60 },
    empty: { color: colors.white, opacity: 0.8, textAlign: 'center', marginTop: spacing.md, lineHeight: 20 },
    sessionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...shadow.card,
    },
    sosCard: {
        borderColor: colors.danger,
        borderWidth: 1.5,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: spacing.md,
    },
    statusDotActive: { backgroundColor: colors.success },
    statusDotMissed: { backgroundColor: colors.danger },
    ownerName: { ...typography.body, fontWeight: '700' },
    statusText: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    sosStatusText: { color: colors.danger, fontWeight: '700' },
});
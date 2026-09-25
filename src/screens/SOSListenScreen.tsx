import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useAudioPlayer } from 'expo-audio';
import { collection, doc, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius, shadow, typography } from '../theme/theme';

type Segment = {
    id: string;
    index: number;
    audioBase64: string;
    createdAt?: Timestamp;
};

type SosDoc = {
    ownerName: string;
    status: 'recording' | 'stopped';
};

type Props = NativeStackScreenProps<any, 'SOSListen'>;

export default function SOSListenScreen({ route }: Props) {
    const { sosId } = route.params as { sosId: string };
    const [sosDoc, setSosDoc] = useState<SosDoc | null>(null);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [currentUri, setCurrentUri] = useState<string | undefined>(undefined);
    const fileCache = useRef<Record<string, string>>({});

    const player = useAudioPlayer(currentUri);

    useEffect(() => {
        const unsubDoc = onSnapshot(doc(db, 'sosRecordings', sosId), (snap) => {
            setSosDoc(snap.data() as SosDoc);
        });

        const q = query(collection(db, 'sosRecordings', sosId, 'segments'), orderBy('index', 'asc'));
        const unsubSegments = onSnapshot(q, (snapshot) => {
            setSegments(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Segment, 'id'>) })));
            setLoading(false);
        });

        return () => {
            unsubDoc();
            unsubSegments();
        };
    }, [sosId]);

    useEffect(() => {
        if (!currentUri) return;
        player.play();
    }, [currentUri]);

    const handlePlay = async (segment: Segment) => {
        try {
            let localUri = fileCache.current[segment.id];
            if (!localUri) {
                localUri = `${FileSystem.cacheDirectory}sos_${segment.id}.m4a`;
                await FileSystem.writeAsStringAsync(localUri, segment.audioBase64, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                fileCache.current[segment.id] = localUri;
            }
            setCurrentUri(localUri);
            setPlayingId(segment.id);
        } catch (err) {
            console.log('Failed to prepare clip for playback', err);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.ownerName}>{sosDoc?.ownerName ?? 'Loading...'}</Text>
                <Text style={styles.statusText}>
                    {sosDoc?.status === 'recording' ? '● Recording live — new clips will appear below' : 'Recording ended'}
                </Text>
            </View>

            <FlatList
                data={segments}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: spacing.lg }}
                ListEmptyComponent={<Text style={styles.empty}>Waiting for the first clip to come in...</Text>}
                renderItem={({ item, index }) => (
                    <TouchableOpacity style={styles.clipRow} onPress={() => handlePlay(item)}>
                        <View style={styles.playIconWrap}>
                            <Ionicons name={playingId === item.id ? 'pause' : 'play'} size={18} color={colors.white} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.clipLabel}>Clip {index + 1}</Text>
                            <Text style={styles.clipTime}>
                                {item.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) ?? '—'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.white },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
    header: {
        backgroundColor: colors.dangerDark,
        padding: spacing.lg,
    },
    ownerName: { color: colors.white, fontFamily: 'Poppins_700Bold', fontSize: 18 },
    statusText: { color: colors.white, opacity: 0.9, fontSize: 13, marginTop: 4 },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    clipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.cardBackground,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadow.card,
    },
    playIconWrap: {
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    clipLabel: { ...typography.body, fontWeight: '700' },
    clipTime: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
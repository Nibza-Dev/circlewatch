import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, SafeAreaView, ImageBackground, TouchableOpacity, Linking } from 'react-native';
import { collection, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../config/firebase';
import { colors, spacing, radius, shadow, typography } from '../theme/theme';

type FeedPost = {
    id: string;
    title: string;
    body: string;
    source?: string;
    url?: string;
    createdAt?: Timestamp;
};

export default function SafetyFeedScreen() {
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [loading, setLoading] = useState(true);
    // Lowercased place names (city/subregion/region) from the device's current
    // location, used only to sort locally-relevant posts to the top. This is
    // best-effort: if permission is denied or it fails, the feed just falls
    // back to the plain national list - nothing else depends on it.
    const [nearbyTerms, setNearbyTerms] = useState<string[]>([]);

    useEffect(() => {
        const q = query(collection(db, 'safetyFeed'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPosts(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedPost, 'id'>) })));
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                const position = await Location.getCurrentPositionAsync({});
                const [place] = await Location.reverseGeocodeAsync({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                if (!place) return;

                const terms = [place.city, place.subregion, place.region]
                    .filter((v): v is string => !!v && v.length > 2)
                    .map((v) => v.toLowerCase());
                setNearbyTerms(Array.from(new Set(terms)));
            } catch (err) {
                // Silent on purpose - location-based sorting is a nice-to-have,
                // not something that should ever block or warn on the feed.
                console.log('Could not determine location for safety feed sorting', err);
            }
        })();
    }, []);

    const isNearby = (post: FeedPost) => {
        if (!nearbyTerms.length) return false;
        const haystack = `${post.title} ${post.body}`.toLowerCase();
        return nearbyTerms.some((term) => haystack.includes(term));
    };

    const sortedPosts = useMemo(() => {
        if (!nearbyTerms.length) return posts;
        // Array.prototype.sort is stable, so within "nearby" and "everything
        // else" the existing newest-first order from Firestore is preserved.
        return [...posts].sort((a, b) => Number(isNearby(b)) - Number(isNearby(a)));
    }, [posts, nearbyTerms]);

    if (loading) {
        return (
            <ImageBackground source={require('../../assets/bg_home.png')} style={styles.center} resizeMode="cover">
                <ActivityIndicator size="large" color={colors.white} />
            </ImageBackground>
        );
    }

    return (
        <ImageBackground source={require('../../assets/bg_home.png')} style={styles.gradient} resizeMode="cover">
            <SafeAreaView style={{ flex: 1 }}>
                <Text style={styles.title}>Safety Updates</Text>
                <FlatList
                    data={sortedPosts}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.empty}>No safety updates right now.</Text>}
                    renderItem={({ item }) => {
                        const nearby = isNearby(item);
                        return (
                            <TouchableOpacity
                                style={styles.card}
                                activeOpacity={item.url ? 0.8 : 1}
                                disabled={!item.url}
                                onPress={() => item.url && Linking.openURL(item.url)}
                            >
                                {nearby && (
                                    <View style={styles.nearbyPill}>
                                        <Text style={styles.nearbyPillText}>Near you</Text>
                                    </View>
                                )}
                                <Text style={styles.postTitle}>{item.title}</Text>
                                <Text style={styles.postBody}>{item.body}</Text>
                                <View style={styles.metaRow}>
                                    {item.source ? (
                                        <View style={styles.sourceBadge}>
                                            <Text style={styles.postSource}>{item.source}</Text>
                                        </View>
                                    ) : <View />}
                                    {item.createdAt?.toDate && (
                                        <Text style={styles.postDate}>{item.createdAt.toDate().toLocaleDateString()}</Text>
                                    )}
                                </View>
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
    title: { ...typography.heading, color: colors.white, textAlign: 'center', paddingTop: spacing.lg, paddingBottom: spacing.sm },
    listContent: { padding: spacing.xl, paddingTop: spacing.sm },
    empty: { color: colors.white, opacity: 0.8, textAlign: 'center', marginTop: 40 },
    card: {
        backgroundColor: colors.cardBackground,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        ...shadow.card,
    },
    nearbyPill: {
        alignSelf: 'flex-start',
        backgroundColor: colors.primary,
        borderRadius: radius.pill,
        paddingVertical: 3,
        paddingHorizontal: spacing.sm,
        marginBottom: spacing.xs,
    },
    nearbyPillText: { color: colors.white, fontSize: 10, fontWeight: '700' },
    postTitle: { ...typography.body, fontWeight: '700', fontSize: 16, marginBottom: spacing.xs },
    postBody: { color: colors.textDark, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm, opacity: 0.85 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sourceBadge: {
        backgroundColor: colors.inputBackground,
        borderRadius: radius.pill,
        paddingVertical: 4,
        paddingHorizontal: spacing.sm,
    },
    postSource: { color: colors.primary, fontSize: 11, fontWeight: '700' },
    postDate: { color: colors.textMuted, fontSize: 11 },
});

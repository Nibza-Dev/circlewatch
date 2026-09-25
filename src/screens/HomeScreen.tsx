import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, SafeAreaView, ImageBackground, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { triggerSOS } from '../utils/sos';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius, shadow, typography } from '../theme/theme';

type Props = NativeStackScreenProps<any, 'Home'>;

function getFriendlyName(user: { displayName?: string | null; email?: string | null } | null): string {
    if (user?.displayName && user.displayName.trim().length > 0) {
        return user.displayName.trim().split(' ')[0];
    }
    if (user?.email) {
        const prefix = user.email.split('@')[0];
        return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return 'there';
}

export default function HomeScreen({ navigation }: Props) {
    const { user, logOut } = useAuth();
    const [sendingSOS, setSendingSOS] = useState(false);

    const pulseAnim = useRef(new Animated.Value(0)).current;
    const cardAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(pulseAnim, {
                toValue: 1,
                duration: 1800,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            })
        ).start();

        Animated.stagger(
            130,
            cardAnims.map((anim) =>
                Animated.timing(anim, {
                    toValue: 1,
                    duration: 450,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                })
            )
        ).start();
    }, []);

    const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
    const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

    const handleSOS = () => {
        Alert.alert(
            'Send SOS Alert?',
            'This will immediately notify your trusted circle with your current location and start recording audio.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send SOS',
                    style: 'destructive',
                    onPress: async () => {
                        if (!user) return;
                        setSendingSOS(true);
                        try {
                            await triggerSOS(user);

                            const userDocSnap = await getDoc(doc(db, 'users', user.uid));
                            const trustedCircle = (userDocSnap.data()?.trustedCircle ?? []) as { uid: string }[];

                            const sosDocRef = await addDoc(collection(db, 'sosRecordings'), {
                                ownerId: user.uid,
                                ownerName: user.displayName ?? user.email,
                                circleUserIds: trustedCircle.map((m) => m.uid),
                                status: 'recording',
                                startedAt: serverTimestamp(),
                            });

                            navigation.navigate('SOSActive', { sosId: sosDocRef.id });
                        } catch (error: any) {
                            Alert.alert('Could not send SOS', error.message ?? 'Something went wrong.');
                        } finally {
                            setSendingSOS(false);
                        }
                    },
                },
            ]
        );
    };

    const menuItems = [
        { icon: 'navigate-outline' as const, label: 'Start Safety Session', sub: 'Share your live route', onPress: () => navigation.navigate('Session') },
        { icon: 'eye-outline' as const, label: 'Watching', sub: "See who's currently out", onPress: () => navigation.navigate('Watching') },
        { icon: 'people-outline' as const, label: 'Trusted Circle', sub: 'Manage who watches over you', onPress: () => navigation.navigate('Circle') },
        { icon: 'newspaper-outline' as const, label: 'Safety Updates', sub: 'Verified alerts near you', onPress: () => navigation.navigate('SafetyFeed') },
    ];

    return (
        <ImageBackground source={require('../../assets/bg_home.png')} style={styles.gradient} resizeMode="cover">
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>Hi, {getFriendlyName(user)}</Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('EditProfile')}
                            style={styles.editButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="pencil" size={14} color={colors.white} />
                        </TouchableOpacity>
                    </View>

                    <BlurView intensity={40} tint="light" style={styles.badgeBlur}>
                        <View style={[styles.badge, user?.emailVerified ? styles.badgeVerified : styles.badgeUnverified]}>
                            <Text style={styles.badgeText}>
                                {user?.emailVerified ? '✓ Email verified' : '⚠ Please verify your email'}
                            </Text>
                        </View>
                    </BlurView>

                    <View style={styles.sosWrap}>
                        <Animated.View
                            style={[
                                styles.pulseRing,
                                { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
                            ]}
                        />
                        <LinearGradient colors={[colors.danger, colors.dangerDark]} style={styles.sosButton}>
                            <TouchableOpacity style={styles.sosTouchable} onPress={handleSOS} disabled={sendingSOS}>
                                {sendingSOS ? (
                                    <ActivityIndicator color={colors.white} />
                                ) : (
                                    <>
                                        <Ionicons name="alert-circle" size={34} color={colors.white} style={{ marginBottom: 2 }} />
                                        <Text style={styles.sosButtonText}>SOS</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>

                    <View style={styles.menu}>
                        {menuItems.map((item, i) => (
                            <Animated.View
                                key={item.label}
                                style={{
                                    opacity: cardAnims[i],
                                    transform: [
                                        {
                                            translateY: cardAnims[i].interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [24, 0],
                                            }),
                                        },
                                    ],
                                }}
                            >
                                <TouchableOpacity onPress={item.onPress} style={styles.menuCardTouchable}>
                                    <BlurView intensity={35} tint="light" style={styles.menuCard}>
                                        <View style={styles.menuIconWrap}>
                                            <Ionicons name={item.icon} size={22} color={colors.primary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.menuLabel}>{item.label}</Text>
                                            <Text style={styles.menuSub}>{item.sub}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                                    </BlurView>
                                </TouchableOpacity>
                            </Animated.View>
                        ))}
                    </View>

                    <TouchableOpacity onPress={() => logOut()} style={styles.logoutLink}>
                        <Text style={styles.logoutText}>Log Out</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        padding: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.xxl,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    title: {
        ...typography.heading,
        color: colors.white,
        textAlign: 'center',
    },
    editButton: {
        width: 26,
        height: 26,
        borderRadius: radius.pill,
        backgroundColor: 'rgba(255,255,255,0.22)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.sm,
    },
    badgeBlur: {
        borderRadius: radius.pill,
        overflow: 'hidden',
        marginBottom: spacing.xl,
    },
    badge: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
    },
    badgeVerified: { backgroundColor: 'rgba(63, 214, 140, 0.3)' },
    badgeUnverified: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
    badgeText: { color: colors.white, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
    sosWrap: {
        width: 150,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    pulseRing: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 100,
        backgroundColor: colors.danger,
    },
    sosButton: {
        borderRadius: 100,
        width: 150,
        height: 150,
        shadowColor: '#FF3B5C',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 12,
    },
    sosTouchable: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sosButtonText: { color: colors.white, fontFamily: 'Poppins_800ExtraBold', fontSize: 22, letterSpacing: 1 },
    menu: {
        width: '100%',
    },
    menuCardTouchable: {
        borderRadius: radius.lg,
        overflow: 'hidden',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...shadow.card,
    },
    menuCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.cardBackground,
        padding: spacing.md,
    },
    menuIconWrap: {
        width: 48,
        height: 48,
        borderRadius: radius.md,
        backgroundColor: 'rgba(123, 47, 247, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    menuLabel: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 15,
        color: colors.textDark,
    },
    menuSub: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    logoutLink: {
        marginTop: spacing.md,
    },
    logoutText: {
        color: colors.white,
        opacity: 0.85,
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 15,
    },
});
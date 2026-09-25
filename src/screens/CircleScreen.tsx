import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, radius, shadow, typography } from '../theme/theme';

type CircleMember = { uid: string; displayName: string; email: string };

export default function CircleScreen() {
    const { user } = useAuth();
    const [circle, setCircle] = useState<CircleMember[]>([]);
    const [emailInput, setEmailInput] = useState('');
    const [adding, setAdding] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            setCircle(snap.data()?.trustedCircle ?? []);
            setLoading(false);
        });
        return unsubscribe;
    }, [user]);

    const handleAdd = async () => {
        const normalizedEmail = emailInput.trim().toLowerCase();
        if (!normalizedEmail) return;
        if (normalizedEmail === user?.email?.toLowerCase()) {
            Alert.alert("That's you", "You can't add yourself to your own circle.");
            return;
        }
        if (circle.some((m) => m.email === normalizedEmail)) {
            Alert.alert('Already added', 'This person is already in your circle.');
            return;
        }

        setAdding(true);
        try {
            const indexSnap = await getDoc(doc(db, 'emailIndex', normalizedEmail));
            if (!indexSnap.exists()) {
                Alert.alert('Not found', 'No CircleWatch account exists with that email. They need to sign up first.');
                return;
            }
            const { uid, displayName } = indexSnap.data() as { uid: string; displayName: string };
            await updateDoc(doc(db, 'users', user!.uid), {
                trustedCircle: arrayUnion({ uid, displayName, email: normalizedEmail }),
            });
            setEmailInput('');
        } catch (error: any) {
            Alert.alert('Could not add contact', error.message ?? 'Something went wrong.');
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = (member: CircleMember) => {
        Alert.alert('Remove from circle?', `${member.displayName} will no longer see your safety sessions.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    if (!user) return;
                    await updateDoc(doc(db, 'users', user.uid), { trustedCircle: arrayRemove(member) });
                },
            },
        ]);
    };

    if (loading) {
        return (
            <ImageBackground source={require('../../assets/bg_home.png')} style={styles.center} resizeMode="cover">
                <ActivityIndicator size="large" color={colors.white} />
            </ImageBackground>
        );
    }

    return (
        <ImageBackground source={require('../../assets/bg_home.png')} style={styles.gradient} resizeMode="cover">
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <SafeAreaView style={styles.container}>
                    <View style={styles.headerRow}>
                        <View style={styles.headerIconWrap}>
                            <Ionicons name="people" size={22} color={colors.white} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>Trusted Circle</Text>
                            <Text style={styles.subtitle}>People who can see your live sessions and get alerted if something's wrong.</Text>
                        </View>
                    </View>

                    <BlurView intensity={60} tint="light" style={styles.addCard}>
                        <View style={styles.addInputWrap}>
                            <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                            <TextInput
                                style={styles.input}
                                placeholder="Add by email"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                value={emailInput}
                                onChangeText={setEmailInput}
                                onSubmitEditing={handleAdd}
                                returnKeyType="done"
                            />
                        </View>
                        <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={adding}>
                            {adding ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Ionicons name="person-add" size={20} color={colors.white} />
                            )}
                        </TouchableOpacity>
                    </BlurView>

                    {circle.length > 0 && (
                        <Text style={styles.countLabel}>
                            {circle.length} {circle.length === 1 ? 'person' : 'people'} watching over you
                        </Text>
                    )}

                    <FlatList
                        data={circle}
                        keyExtractor={(item) => item.uid}
                        contentContainerStyle={{ paddingBottom: spacing.xl, paddingTop: spacing.xs }}
                        ListEmptyComponent={
                            <View style={styles.emptyWrap}>
                                <Ionicons name="people-outline" size={40} color={colors.white} style={{ opacity: 0.6 }} />
                                <Text style={styles.empty}>Your circle is empty.{'\n'}Add someone you trust above.</Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <BlurView intensity={60} tint="light" style={styles.memberRow}>
                                <View style={styles.memberAvatar}>
                                    <Text style={styles.memberInitial}>{item.displayName?.[0]?.toUpperCase() ?? '?'}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.memberName}>{item.displayName}</Text>
                                    <Text style={styles.memberEmail}>{item.email}</Text>
                                </View>
                                <TouchableOpacity style={styles.removeButton} onPress={() => handleRemove(item)}>
                                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                                </TouchableOpacity>
                            </BlurView>
                        )}
                    />
                </SafeAreaView>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    container: {
        flex: 1,
        paddingHorizontal: 100,
        paddingTop: spacing.xl,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: spacing.xl,
        marginBottom: spacing.lg,
    },
    headerIconWrap: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    title: { ...typography.heading, color: colors.white },
    subtitle: { fontSize: 13, color: colors.white, opacity: 0.85, marginTop: 4, lineHeight: 18 },
    addCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.lg,
        padding: spacing.sm,
        marginBottom: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...shadow.card,
    },
    addInputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inputBackground,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        color: colors.textDark,
        paddingVertical: spacing.md,
        fontSize: 15,
    },
    addButton: {
        width: 46,
        height: 46,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadow.button,
    },
    countLabel: {
        color: colors.white,
        opacity: 0.75,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    emptyWrap: { alignItems: 'center', marginTop: 60 },
    empty: { color: colors.white, opacity: 0.8, textAlign: 'center', marginTop: spacing.md, lineHeight: 20 },
    memberRow: {
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
    memberAvatar: {
        width: 42,
        height: 42,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    memberInitial: { color: colors.white, fontWeight: '700', fontSize: 16 },
    memberName: { ...typography.body, fontWeight: '700' },
    memberEmail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    removeButton: {
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        backgroundColor: 'rgba(255, 59, 92, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.sm,
    },
});
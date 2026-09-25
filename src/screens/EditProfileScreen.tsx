import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius, shadow, typography } from '../theme/theme';

type Props = NativeStackScreenProps<any, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
    const { user, updateDisplayName } = useAuth();
    const [name, setName] = useState(user?.displayName ?? '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Name required', 'Please enter a name.');
            return;
        }
        setSaving(true);
        try {
            await updateDisplayName(name);
            Alert.alert('Saved', 'Your name has been updated.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error: any) {
            Alert.alert('Could not save', error.message ?? 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ImageBackground source={require('../../assets/bg_home.png')} style={styles.gradient} resizeMode="cover">
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.container}>
                    <View style={styles.card}>
                        <Text style={styles.title}>Edit Profile</Text>
                        <Text style={styles.subtitle}>This is the name your trusted circle will see.</Text>

                        <Text style={styles.label}>Display name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Your name"
                            placeholderTextColor={colors.textMuted}
                            value={name}
                            onChangeText={setName}
                            autoFocus
                        />

                        <Text style={styles.emailLabel}>{user?.email}</Text>

                        <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Save Changes</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    container: { flex: 1, justifyContent: 'center', padding: spacing.xl },
    card: {
        backgroundColor: colors.cardBackground,
        borderRadius: radius.xl,
        padding: spacing.xl,
        ...shadow.card,
    },
    title: { ...typography.heading, textAlign: 'center' },
    subtitle: { ...typography.subheading, textAlign: 'center', marginBottom: spacing.lg, marginTop: spacing.xs },
    label: { color: colors.textMuted, marginBottom: spacing.sm, fontSize: 14, fontWeight: '600' },
    input: {
        backgroundColor: colors.inputBackground,
        color: colors.textDark,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.sm,
        fontSize: 16,
    },
    emailLabel: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.lg },
    button: {
        backgroundColor: colors.primary,
        borderRadius: radius.pill,
        padding: spacing.md,
        alignItems: 'center',
        ...shadow.button,
    },
    buttonText: { ...typography.button },
    cancelText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, fontWeight: '600' },
});
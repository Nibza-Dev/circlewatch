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
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius, shadow, typography } from '../theme/theme';

type Props = NativeStackScreenProps<any, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            Alert.alert('Email required', 'Enter the email you used to sign up.');
            return;
        }

        setSending(true);
        try {
            await sendPasswordResetEmail(auth, normalizedEmail);
            Alert.alert(
                'Check your email',
                "If an account exists for that email, we've sent a link to reset your password.",
                [{ text: 'Back to Login', onPress: () => navigation.navigate('Login') }]
            );
        } catch (error: any) {
            Alert.alert('Could not send reset link', error.message ?? 'Something went wrong.');
        } finally {
            setSending(false);
        }
    };

    return (
        <ImageBackground source={require('../../assets/bg_home.png')} style={styles.gradient} resizeMode="cover">
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.container}>
                    <View style={styles.card}>
                        <Text style={styles.title}>Reset Password</Text>
                        <Text style={styles.subtitle}>Enter your email and we'll send you a link to reset your password.</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            value={email}
                            onChangeText={setEmail}
                        />

                        <TouchableOpacity style={styles.button} onPress={handleSend} disabled={sending}>
                            {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.link}>Back to Login</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
    card: {
        backgroundColor: colors.cardBackground,
        borderRadius: radius.xl,
        padding: spacing.xl,
        ...shadow.card,
    },
    title: { ...typography.heading, textAlign: 'center' },
    subtitle: {
        ...typography.subheading,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
        lineHeight: 20,
    },
    input: {
        backgroundColor: colors.inputBackground,
        color: colors.textDark,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.lg,
        fontSize: 16,
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: radius.pill,
        padding: spacing.md,
        alignItems: 'center',
        ...shadow.button,
    },
    buttonText: { ...typography.button },
    link: {
        color: colors.primary,
        textAlign: 'center',
        marginTop: spacing.lg,
        fontWeight: '600',
    },
});
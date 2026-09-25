import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    ScrollView,
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius, shadow, typography } from '../theme/theme';

type Props = NativeStackScreenProps<any, 'SignUp'>;

const PASSWORD_RULES = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

export default function SignUpScreen({ navigation }: Props) {
    const { signUp } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignUp = async () => {
        if (!displayName || !email || !password || !confirmPassword) {
            Alert.alert('Missing info', 'Please fill in every field.');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Passwords do not match', 'Please re-enter your password.');
            return;
        }
        if (!PASSWORD_RULES.test(password)) {
            Alert.alert('Password too weak', 'Password must be at least 8 characters and include an uppercase letter, a number, and a symbol.');
            return;
        }

        setLoading(true);
        try {
            await signUp(email.trim(), password, displayName.trim());
            Alert.alert('Check your email', 'We sent you a verification link. Please verify your email before adding trusted contacts or starting a session.');
        } catch (error: any) {
            Alert.alert('Sign up failed', error.message ?? 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ImageBackground source={require('../../assets/bg_home.png')} style={styles.gradient} resizeMode="cover">
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Image source={require('../../assets/icon.png')} style={styles.logo} />

                    <View style={styles.card}>
                        <Text style={styles.title}>Join CircleWatch</Text>
                        <Text style={styles.subtitle}>Create your account</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Full name"
                            placeholderTextColor={colors.textMuted}
                            value={displayName}
                            onChangeText={setDisplayName}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            value={email}
                            onChangeText={setEmail}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor={colors.textMuted}
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm password"
                            placeholderTextColor={colors.textMuted}
                            secureTextEntry
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                        />
                        <Text style={styles.hint}>Min. 8 characters, with an uppercase letter, a number, and a symbol.</Text>

                        <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text style={styles.buttonText}>Sign Up</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.link}>Already have an account? Log in</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
        paddingVertical: spacing.xxl,
    },
    logo: {
        width: 72,
        height: 72,
        borderRadius: radius.lg,
        marginBottom: spacing.lg,
    },
    card: {
        width: '100%',
        backgroundColor: colors.cardBackground,
        borderRadius: radius.xl,
        padding: spacing.xl,
        ...shadow.card,
    },
    title: {
        ...typography.heading,
        textAlign: 'center',
    },
    subtitle: {
        ...typography.subheading,
        textAlign: 'center',
        marginBottom: spacing.lg,
        marginTop: spacing.xs,
    },
    input: {
        backgroundColor: colors.inputBackground,
        color: colors.textDark,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.md,
        fontSize: 16,
    },
    hint: {
        color: colors.textMuted,
        fontSize: 12,
        marginBottom: spacing.md,
        marginTop: -spacing.sm,
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: radius.pill,
        padding: spacing.md,
        alignItems: 'center',
        marginTop: spacing.xs,
        ...shadow.button,
    },
    buttonText: {
        ...typography.button,
    },
    link: {
        color: colors.primary,
        textAlign: 'center',
        marginTop: spacing.lg,
        fontWeight: '600',
    },
});
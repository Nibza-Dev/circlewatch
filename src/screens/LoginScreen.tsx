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
    ScrollView,
    Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius, shadow, typography } from '../theme/theme';

type Props = NativeStackScreenProps<any, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Missing info', 'Please enter your email and password.');
            return;
        }
        setLoading(true);
        try {
            await signIn(email.trim(), password);
        } catch (error: any) {
            Alert.alert('Login failed', error.message ?? 'Something went wrong.');
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
                    <Text style={styles.brandName}>CircleWatch</Text>
                    <Text style={styles.brandSlogan}>You are never walking alone.</Text>

                    <View style={styles.card}>
                        <Text style={styles.title}>Welcome Back</Text>

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

                        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotLink}>
                            <Text style={styles.forgotText}>Forgot password?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text style={styles.buttonText}>Log In</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                            <Text style={styles.link}>Don't have an account? Sign up</Text>
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
    },
    brandName: {
        fontFamily: 'Fredoka_700Bold',
        fontSize: 38,
        color: colors.white,
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    brandSlogan: {
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
        color: colors.white,
        opacity: 0.9,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.xl,
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
        marginBottom: spacing.lg,
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
    forgotLink: {
        alignSelf: 'flex-end',
        marginTop: -spacing.xs,
        marginBottom: spacing.md,
    },
    forgotText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '600',
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
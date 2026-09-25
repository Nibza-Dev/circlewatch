import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { addDoc, collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme/theme';

type Props = NativeStackScreenProps<any, 'SOSActive'>;

const SEGMENT_DURATION_MS = 15000; // rolling 15-second clips

const isLikelyCallConflict = (err: any) => {
    const msg = String(err?.message ?? err ?? '');
    return msg.includes('Session activation failed') || msg.includes('AudioRecordingException');
};

export default function SOSActiveScreen({ route, navigation }: Props) {
    const { sosId } = route.params as { sosId: string };
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
    const [segmentCount, setSegmentCount] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [audioNotice, setAudioNotice] = useState<string | null>(null);
    const isActiveRef = useRef(true);
    const segmentIndexRef = useRef(0);

    useEffect(() => {
        let elapsedTimer: ReturnType<typeof setInterval>;

        const uploadSegment = async () => {
            const uri = audioRecorder.uri;
            if (!uri) return;
            try {
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                const index = segmentIndexRef.current;
                segmentIndexRef.current += 1;
                await addDoc(collection(db, 'sosRecordings', sosId, 'segments'), {
                    index,
                    audioBase64: base64,
                    mimeType: 'audio/m4a',
                    createdAt: serverTimestamp(),
                });
                setSegmentCount((c) => c + 1);
                await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch (err: any) {
                // Upload/file errors are unexpected (not the call-conflict case) — surface plainly.
                console.log('Failed to save recording segment', err);
                setAudioNotice("Audio couldn't be saved just now. Your location is still being shared with your circle.");
            }
        };

        const run = async () => {
            const permission = await requestRecordingPermissionsAsync();
            if (!permission.granted) {
                setPermissionGranted(false);
                Alert.alert('Microphone needed', "CircleWatch needs microphone access to record what's happening during an SOS.");
                return;
            }
            setPermissionGranted(true);

            // Give iOS a moment to settle before claiming the audio session —
            // activating immediately after permission grant can race and fail.
            await new Promise((resolve) => setTimeout(resolve, 500));
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await new Promise((resolve) => setTimeout(resolve, 300));

            elapsedTimer = setInterval(() => {
                setElapsedSeconds((s) => s + 1);
            }, 1000);

            while (isActiveRef.current) {
                let started = false;
                let lastCaughtError: any = null;

                for (let attempt = 0; attempt < 3 && !started; attempt++) {
                    try {
                        if (attempt > 0) {
                            await new Promise((resolve) => setTimeout(resolve, 500));
                        }
                        await audioRecorder.prepareToRecordAsync();
                        audioRecorder.record();
                        started = true;
                    } catch (err: any) {
                        console.log(`prepareToRecordAsync attempt ${attempt + 1} failed`, err);
                        lastCaughtError = err;
                    }
                }

                if (!isActiveRef.current) break;

                if (!started) {
                    // Mic is occupied (most likely a call) or otherwise unavailable right now.
                    // Don't kill the SOS — location/circle alerting doesn't need audio.
                    // Keep quietly retrying every segment interval in case it frees up.
                    setAudioNotice(
                        isLikelyCallConflict(lastCaughtError)
                            ? "Audio paused — your phone's microphone is in use by a call. Your location is still being shared with your circle."
                            : 'Audio recording is temporarily unavailable. Your location is still being shared with your circle.'
                    );
                    await new Promise((resolve) => setTimeout(resolve, SEGMENT_DURATION_MS));
                    continue;
                }

                setAudioNotice(null);

                try {
                    await new Promise((resolve) => setTimeout(resolve, SEGMENT_DURATION_MS));
                    await audioRecorder.stop();
                    await uploadSegment();
                } catch (err: any) {
                    console.log('Recording segment failed', err);
                    setAudioNotice('Audio recording hit a snag. Your location is still being shared with your circle.');
                }
            }
        };

        run();

        return () => {
            isActiveRef.current = false;
            clearInterval(elapsedTimer);
        };
    }, []);

    const handleStop = async () => {
        isActiveRef.current = false;
        try {
            await updateDoc(doc(db, 'sosRecordings', sosId), { status: 'stopped', stoppedAt: serverTimestamp() });
        } catch (err) {
            console.log('Failed to mark recording stopped', err);
        }
        Alert.alert('Recording stopped', 'Your recording has been saved and is available to your trusted circle.', [
            { text: 'OK', onPress: () => navigation.navigate('Home') },
        ]);
    };

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <View style={styles.container}>
            <View style={styles.pulseDot} />
            <Text style={styles.title}>Recording</Text>
            <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
            <Text style={styles.subtitle}>
                {permissionGranted === false
                    ? "Microphone access was denied — your circle is still alerted, but audio isn't being recorded."
                    : "Your trusted circle can listen to this in real time. Describe your location and what's happening."}
            </Text>
            <Text style={styles.segmentInfo}>{segmentCount} clip{segmentCount === 1 ? '' : 's'} saved safely</Text>
            {audioNotice && <Text style={styles.noticeText}>{audioNotice}</Text>}

            <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
                <Text style={styles.stopButtonText}>Stop Recording</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.dangerDark,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    pulseDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.white, marginBottom: spacing.lg },
    title: { color: colors.white, fontFamily: 'Poppins_700Bold', fontSize: 24, marginBottom: spacing.sm },
    timer: { color: colors.white, fontFamily: 'Poppins_800ExtraBold', fontSize: 48, marginBottom: spacing.lg },
    subtitle: { color: colors.white, opacity: 0.9, textAlign: 'center', fontSize: 14, lineHeight: 20, marginBottom: spacing.md, paddingHorizontal: spacing.md },
    segmentInfo: { color: colors.white, opacity: 0.75, fontSize: 12, marginBottom: spacing.sm },
    noticeText: { color: '#FFE8CC', fontSize: 12, textAlign: 'center', marginBottom: spacing.xxl, paddingHorizontal: spacing.md, opacity: 0.9 },
    stopButton: {
        backgroundColor: colors.white,
        borderRadius: radius.pill,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
    },
    stopButtonText: { color: colors.dangerDark, fontFamily: 'Poppins_700Bold', fontSize: 16 },
});
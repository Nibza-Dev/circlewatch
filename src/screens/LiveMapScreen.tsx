import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius, shadow, typography } from '../theme/theme';

type SessionData = {
    ownerName: string;
    status: 'active' | 'missed' | 'completed' | 'sos';
    expectedArrivalAt?: Timestamp;
    lastLocation?: { latitude: number; longitude: number };
};

type Props = NativeStackScreenProps<any, 'LiveMap'>;

// Free MapTiler key (cloud.maptiler.com -> Account -> Keys). Gives
// unlimited requests to the preset "streets" style with true retina
// (512px) tiles, unlike plain OpenStreetMap which only serves 256px.
const MAPTILER_API_KEY = 'UF7oJrl9ZnV0mF9JPh3n';

function buildMapHtml(lat: number, lng: number) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #EDE7F6; }
    .leaflet-control-attribution { font-size: 9px; opacity: 0.55; }
    .pulse-marker { width: 20px; height: 20px; border-radius: 50%; background: #7B2FF7; border: 3px solid white; animation: pulse-ring 2.2s ease-out infinite; }
    @keyframes pulse-ring {
      0%   { box-shadow: 0 0 0 0 rgba(123,47,247,0.45); }
      70%  { box-shadow: 0 0 0 18px rgba(123,47,247,0); }
      100% { box-shadow: 0 0 0 0 rgba(123,47,247,0); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 16);
    L.tileLayer('https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}', {
      tileSize: 512,
      zoomOffset: -1,
      detectRetina: true,
      crossOrigin: true,
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; OpenStreetMap contributors'
    }).addTo(map);

    var pulseIcon = L.divIcon({
      className: '',
      html: '<div class="pulse-marker"></div>',
      iconSize: [20,20],
      iconAnchor: [10,10],
    });

    var marker = L.marker([${lat}, ${lng}], { icon: pulseIcon }).addTo(map);

    function handleMessage(event) {
      try {
        var data = JSON.parse(event.data);
        if (typeof data.lat === 'number' && typeof data.lng === 'number') {
          var newLatLng = [data.lat, data.lng];
          marker.setLatLng(newLatLng);
          map.panTo(newLatLng);
        }
      } catch (e) {}
    }
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>`;
}

export default function LiveMapScreen({ route }: Props) {
    const { sessionId } = route.params as { sessionId: string };
    const [session, setSession] = useState<SessionData | null>(null);
    const [mapHtml, setMapHtml] = useState<string | null>(null);
    const webviewRef = useRef<WebView>(null);
    const hasMapRef = useRef(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
            const data = snap.data() as SessionData | undefined;
            if (!data) return;
            setSession(data);

            if (data.lastLocation) {
                if (!hasMapRef.current) {
                    hasMapRef.current = true;
                    setMapHtml(buildMapHtml(data.lastLocation.latitude, data.lastLocation.longitude));
                } else {
                    webviewRef.current?.postMessage(
                        JSON.stringify({ lat: data.lastLocation.latitude, lng: data.lastLocation.longitude })
                    );
                }
            }
        });
        return unsubscribe;
    }, [sessionId]);

    const arrival = session?.expectedArrivalAt?.toDate?.();
    const missed = session?.status === 'missed';

    return (
        <View style={{ flex: 1, backgroundColor: '#EDE7F6' }}>
            {mapHtml ? (
                <WebView
                    ref={webviewRef}
                    originWhitelist={['*']}
                    source={{ html: mapHtml }}
                    style={{ flex: 1 }}
                    javaScriptEnabled
                    // Matches the "Allowed user-agent header" restriction set on the
                    // MapTiler key (cloud.maptiler.com -> API keys -> circlewatch),
                    // so the key only works from this app's WebView, not from just
                    // anywhere it might get copied to.
                    userAgent="CircleWatchApp/1.0"
                />
            ) : (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Waiting for location...</Text>
                </View>
            )}

            <SafeAreaView style={styles.overlayWrap} pointerEvents="box-none">
                <View style={styles.overlayCard}>
                    <View style={styles.overlayRow}>
                        <View style={[styles.dot, missed ? styles.dotMissed : styles.dotActive]} />
                        <Text style={styles.overlayName}>{session?.ownerName ?? 'Loading...'}</Text>
                    </View>
                    <Text style={[styles.overlayStatus, missed && styles.overlayStatusMissed]}>
                        {missed
                            ? 'Missed check-in — trusted circle has been alerted'
                            : `Expected by ${arrival ? arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}`}
                    </Text>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EDE7F6' },
    loadingText: { marginTop: spacing.md, color: colors.textMuted, fontSize: 14 },
    overlayWrap: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    overlayCard: {
        backgroundColor: colors.cardBackground,
        borderRadius: radius.lg,
        padding: spacing.md,
        ...shadow.card,
    },
    overlayRow: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
    dotActive: { backgroundColor: colors.success },
    dotMissed: { backgroundColor: colors.danger },
    overlayName: { ...typography.body, fontWeight: '700', fontSize: 16 },
    overlayStatus: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
    overlayStatusMissed: { color: colors.danger, fontWeight: '700' },
});
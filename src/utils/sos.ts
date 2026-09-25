import * as Location from 'expo-location';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { sendPushAlert } from './notifications';
import type { User } from 'firebase/auth';

export async function triggerSOS(user: User) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        throw new Error('Location permission is required to send an SOS alert.');
    }

    const position = await Location.getCurrentPositionAsync({});
    const userDocSnap = await getDoc(doc(db, 'users', user.uid));
    const trustedCircle = (userDocSnap.data()?.trustedCircle ?? []) as { uid: string }[];

    await addDoc(collection(db, 'sessions'), {
        ownerId: user.uid,
        ownerName: user.displayName ?? user.email,
        circleUserIds: trustedCircle.map((m) => m.uid),
        status: 'sos',
        alertSent: true,
        startedAt: serverTimestamp(),
        expectedArrivalAt: serverTimestamp(),
        lastLocation: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    });

    const tokens: string[] = [];
    for (const member of trustedCircle) {
        const tokenSnap = await getDoc(doc(db, 'pushTokens', member.uid));
        const token = tokenSnap.data()?.token;
        if (token) tokens.push(token);
    }

    const mapsLink = `https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`;

    await sendPushAlert(
        tokens,
        '🚨 SOS ALERT',
        `${user.displayName ?? user.email} needs help right now. Location: ${mapsLink}`,
        { type: 'sos', lat: position.coords.latitude, lng: position.coords.longitude }
    );
}
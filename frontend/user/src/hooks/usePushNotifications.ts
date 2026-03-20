import { useState, useEffect, useCallback } from 'react';
import { api } from '@shared/api/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function usePushNotifications() {
    const [permission, setPermission] = useState<NotificationPermission>(
        typeof window !== 'undefined' ? Notification.permission : 'default'
    );
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        const checkSupport = async () => {
            const supported = 'serviceWorker' in navigator && 'PushManager' in window;
            setIsSupported(supported);

            if (supported) {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                setIsSubscribed(!!subscription);
            }
            setLoading(false);
        };
        checkSupport();
    }, []);

    const subscribe = useCallback(async () => {
        if (!isSupported) return false;

        setLoading(true);
        try {
            // 1. Request permission
            const status = await Notification.requestPermission();
            setPermission(status);

            if (status !== 'granted') {
                throw new Error('Permission not granted');
            }

            // 2. Register for push
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            // 3. Send to backend
            const subData = subscription.toJSON();
            await api.post('/user/push/subscribe', {
                endpoint: subData.endpoint,
                p256dh: subData.keys?.p256dh,
                auth: subData.keys?.auth,
            });

            setIsSubscribed(true);
            return true;
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
            return false;
        } finally {
            setLoading(false);
        }
    }, [isSupported]);

    const unsubscribe = useCallback(async () => {
        if (!isSupported) return false;

        setLoading(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // 1. Remove from backend
                await api.delete('/user/push/unsubscribe', { endpoint: subscription.endpoint });

                // 2. Unsubscribe from browser
                await subscription.unsubscribe();
            }

            setIsSubscribed(false);
            return true;
        } catch (error) {
            console.error('Failed to unsubscribe from push notifications:', error);
            return false;
        } finally {
            setLoading(false);
        }
    }, [isSupported]);

    return {
        isSupported,
        permission,
        isSubscribed,
        loading,
        subscribe,
        unsubscribe,
    };
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

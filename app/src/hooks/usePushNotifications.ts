import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

function checkSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = checkSupported();
    setIsSupported(supported);
    if (!supported) return;
    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!checkSupported()) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const { data } = await apiClient.get<{ publicKey: string }>('/notifications/vapid-public-key');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await apiClient.post('/notifications/subscribe', {
        endpoint: json.endpoint,
        keys: json.keys,
      });

      setIsSubscribed(true);
    } catch {
      // permission denied or subscription failed — no-op
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!checkSupported()) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiClient.delete('/notifications/subscribe', { data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  return { permission, isSubscribed, loading, subscribe, unsubscribe, isSupported };
}

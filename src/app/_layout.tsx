import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getDb } from '../lib/db';
import { recoverInterrupted } from '../lib/pipeline';
import { setupNotifications } from '../lib/reminders';
import { loadSettings } from '../lib/settings';
import { useTheme } from '../ui/theme';

export default function RootLayout() {
  const t = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await getDb();
      await loadSettings();
      await setupNotifications().catch(() => {});
      setReady(true);
      recoverInterrupted().catch((e) => console.warn('recover failed', e));
    })();

    const openFromNotification = (response: Notifications.NotificationResponse | null) => {
      const noteId = response?.notification.request.content.data?.noteId;
      if (typeof noteId === 'string') router.push(`/note/${noteId}`);
    };
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Pocket Notes' }} />
        <Stack.Screen name="record" options={{ title: 'Recording', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="note/[id]" options={{ title: '' }} />
        <Stack.Screen name="report/[id]" options={{ title: 'Report' }} />
        <Stack.Screen name="new-text" options={{ title: 'New note', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getActionItem, updateActionItem, type ActionItem } from './db';

export { parseDue } from './text';

const CHANNEL = 'reminders';

export async function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function scheduleReminder(item: ActionItem, at: Date) {
  if (at.getTime() <= Date.now()) throw new Error('Pick a time in the future.');
  if (!(await ensurePermission())) throw new Error('Notifications are turned off for Pocket Notes.');
  if (item.reminderId) await Notifications.cancelScheduledNotificationAsync(item.reminderId).catch(() => {});
  const reminderId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reminder',
      body: item.text,
      data: { noteId: item.noteId, actionId: item.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: CHANNEL,
    },
  });
  await updateActionItem(item.id, { reminderId, reminderAt: at.getTime() });
}

export async function cancelReminder(itemId: string) {
  const item = await getActionItem(itemId);
  if (item?.reminderId) await Notifications.cancelScheduledNotificationAsync(item.reminderId).catch(() => {});
  await updateActionItem(itemId, { reminderId: null, reminderAt: null });
}

/** Quick presets offered when setting a reminder. */
export function reminderPresets(item: ActionItem) {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const tonight = new Date(now);
  tonight.setHours(18, 0, 0, 0);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const presets: { label: string; at: Date }[] = [];
  if (item.dueAt && item.dueAt > now.getTime()) {
    presets.push({ label: `When due (${formatWhen(item.dueAt)})`, at: new Date(item.dueAt) });
  }
  presets.push({ label: 'In 1 hour', at: inOneHour });
  if (tonight.getTime() > now.getTime() + 15 * 60 * 1000) presets.push({ label: 'This evening (6pm)', at: tonight });
  presets.push({ label: 'Tomorrow morning (9am)', at: tomorrow });
  return presets;
}

export function formatWhen(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

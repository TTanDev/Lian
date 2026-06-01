import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ProactiveMessage } from '@/features/exes/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermissions() {
  if (Platform.OS === 'web') {
    return true;
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return requested.granted;
}

export async function scheduleProactiveNotification(message: ProactiveMessage, characterName: string) {
  if (Platform.OS === 'web') {
    return `web-notification-${message.id}`;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      body: message.content,
      data: {
        exId: message.exId,
        proactiveMessageId: message.id,
      },
      sound: true,
      title: characterName,
    },
    trigger: {
      date: new Date(message.scheduledAt),
      type: Notifications.SchedulableTriggerInputTypes.DATE,
    },
  });
}

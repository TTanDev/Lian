import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { deliverProactiveMessage } from '@/features/exes/repository';

export function registerProactiveNotificationResponseHandler() {
  const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
    const data = response.notification.request.content.data as {
      exId?: string;
      proactiveMessageId?: string;
    };

    if (!data.proactiveMessageId) {
      return;
    }

    const exId = await deliverProactiveMessage(data.proactiveMessageId);
    if (exId ?? data.exId) {
      router.push(`/chat/${exId ?? data.exId}`);
    }
  });

  return () => subscription.remove();
}

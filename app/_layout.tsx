import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { registerProactiveNotificationResponseHandler } from '@/features/proactive/responseHandler';
import { palette } from '@/theme/palette';

export default function RootLayout() {
  useEffect(() => registerProactiveNotificationResponseHandler(), []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      />
    </>
  );
}

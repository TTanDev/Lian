import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/palette';

type ErrorBoundaryProps = {
  error: Error;
  retry: () => void;
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorScreen}>
      <Text style={styles.errorKicker}>恋</Text>
      <Text style={styles.errorTitle}>启动时出了点问题</Text>
      <Text style={styles.errorBody}>{error.message}</Text>
      <Pressable style={styles.errorButton} onPress={retry}>
        <Text style={styles.errorButtonText}>再试一次</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function registerNotifications() {
      try {
        const module = await import('@/features/proactive/responseHandler');
        cleanup = module.registerProactiveNotificationResponseHandler();
      } catch (error) {
        console.warn('Failed to register notification response handler', error);
      }
    }

    registerNotifications();

    return () => cleanup?.();
  }, []);

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

const styles = StyleSheet.create({
  errorScreen: {
    backgroundColor: palette.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  errorKicker: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  errorTitle: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 12,
  },
  errorBody: {
    color: palette.subtle,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  errorButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.accent,
    borderRadius: 16,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  errorButtonText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
});

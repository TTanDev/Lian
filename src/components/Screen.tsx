import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { palette } from '@/theme/palette';

type ScreenProps = {
  children: ReactNode;
};

export function Screen({ children }: ScreenProps) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[palette.background, palette.backgroundAlt, palette.background]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  glowTop: {
    backgroundColor: palette.glowRose,
    borderRadius: 140,
    height: 220,
    opacity: 0.24,
    position: 'absolute',
    right: -90,
    top: -80,
    width: 220,
  },
  glowBottom: {
    backgroundColor: palette.glowCyan,
    borderRadius: 150,
    bottom: -100,
    height: 240,
    left: -100,
    opacity: 0.18,
    position: 'absolute',
    width: 240,
  },
});

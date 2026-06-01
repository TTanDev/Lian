import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { palette } from '@/theme/palette';

type GlassCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GlassCard({ children, style }: GlassCardProps) {
  return (
    <BlurView intensity={32} tint="dark" style={[styles.card, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: palette.stroke,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
  },
});

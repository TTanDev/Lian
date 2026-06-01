import { Link } from 'expo-router';
import { MessageCircle, Plus, Settings } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { useExProfiles } from '@/features/exes/hooks';
import { palette } from '@/theme/palette';

export default function ExListScreen() {
  const { data: exProfiles, error, loading } = useExProfiles();

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>恋</Text>
          <Text style={styles.title}>她</Text>
        </View>
        <View style={styles.headerActions}>
          <Link href="/settings" asChild>
            <Pressable style={styles.iconButton}>
              <Settings color={palette.text} size={21} />
            </Pressable>
          </Link>
          <Pressable style={styles.primaryButton}>
            <Plus color={palette.text} size={22} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? <Text style={styles.stateText}>正在读取本地数据...</Text> : null}
        {error ? <Text style={styles.stateText}>{error}</Text> : null}
        {!loading && !error && exProfiles.length === 0 ? (
          <Text style={styles.stateText}>还没有添加她，点右上角添加一个。</Text>
        ) : null}
        {exProfiles.map((ex) => (
          <Link key={ex.id} href={`/chat/${ex.id}`} asChild>
            <Pressable>
              <GlassCard style={styles.card}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{ex.avatar}</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.row}>
                    <Text style={styles.name}>{ex.name}</Text>
                    <Text style={styles.time}>{ex.lastMessageAt}</Text>
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>
                    {ex.lastMessage}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={styles.temperature}>
                      <MessageCircle color={palette.muted} size={13} />
                      <Text style={styles.metaText}>关系温度 {ex.temperature}</Text>
                    </View>
                    <Text style={styles.mood}>{ex.mood}</Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  stateText: {
    color: palette.subtle,
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 4,
  },
  kicker: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  title: {
    color: palette.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: palette.glassStrong,
    borderColor: palette.stroke,
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  list: {
    gap: 14,
    paddingBottom: 28,
  },
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.avatar,
    borderRadius: 24,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  avatarText: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
  },
  cardBody: {
    flex: 1,
    gap: 7,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  time: {
    color: palette.muted,
    fontSize: 12,
  },
  preview: {
    color: palette.subtle,
    fontSize: 14,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  temperature: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  metaText: {
    color: palette.muted,
    fontSize: 12,
  },
  mood: {
    color: palette.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
});

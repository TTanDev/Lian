import { StyleSheet, Text, View } from 'react-native';

import { ChatMessage } from '@/features/exes/types';
import { palette } from '@/theme/palette';

type ChatBubbleProps = {
  message: ChatMessage;
};

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAssistant]}>
      {!isUser && message.delayNote ? <Text style={styles.delay}>{message.delayNote}</Text> : null}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={styles.text}>{message.content}</Text>
        {message.sticker ? (
          <View style={styles.sticker}>
            <Text style={styles.stickerText}>{message.sticker}</Text>
          </View>
        ) : null}
        <Text style={styles.time}>{message.time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxWidth: '84%',
  },
  wrapperUser: {
    alignSelf: 'flex-end',
  },
  wrapperAssistant: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 20,
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: palette.userBubble,
    borderBottomRightRadius: 7,
  },
  assistantBubble: {
    backgroundColor: palette.assistantBubble,
    borderBottomLeftRadius: 7,
    borderColor: palette.stroke,
    borderWidth: 1,
  },
  text: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
  },
  time: {
    alignSelf: 'flex-end',
    color: palette.muted,
    fontSize: 10,
  },
  delay: {
    color: palette.muted,
    fontSize: 11,
    marginBottom: 5,
    marginLeft: 6,
  },
  sticker: {
    alignItems: 'center',
    backgroundColor: palette.sticker,
    borderRadius: 16,
    height: 58,
    justifyContent: 'center',
    width: 72,
  },
  stickerText: {
    fontSize: 28,
  },
});

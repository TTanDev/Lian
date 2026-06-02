import { registerRootComponent } from 'expo';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

function DiagnosticApp() {
  const [pressedAt, setPressedAt] = useState(null);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.kicker}>恋</Text>
        <Text style={styles.title}>诊断版已启动</Text>
        <Text style={styles.body}>
          这个包只加载 React Native 基础入口，用来确认真机运行环境是否正常。
        </Text>
        <Pressable style={styles.button} onPress={() => setPressedAt(new Date().toLocaleTimeString())}>
          <Text style={styles.buttonText}>点我测试交互</Text>
        </Pressable>
        {pressedAt ? <Text style={styles.state}>最后点击：{pressedAt}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#141218',
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  kicker: {
    color: '#ff5f93',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 14,
  },
  body: {
    color: '#cfc7d6',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 22,
  },
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f45c91',
    borderRadius: 16,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  state: {
    color: '#8ee6dc',
    fontSize: 14,
    marginTop: 18,
  },
});

registerRootComponent(DiagnosticApp);

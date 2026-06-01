# iOS 构建和 Sideloadly 安装说明

## 重要结论

EAS Build 可以云端编译 iOS，但如果要生成可安装到真机的 iOS build，Expo 官方流程仍然需要加入付费 Apple Developer Program，用来创建正式的签名凭据。只有免费 Apple ID / 免费开发者身份还不够。也就是说：

- `eas build --profile ios-simulator --platform ios`：可以构建 iOS 模拟器版本，但不能装到 iPhone。
- `eas build --profile ios-device-paid --platform ios`：适合已加入 99 美金/年的 Apple Developer Program 时做真机内部版。
- 免费 Sideloadly 路线：需要先生成 unsigned IPA，再交给 Sideloadly 用免费 Apple ID 签名安装。

## 推荐路线

当前项目提供一个 GitHub Actions 工作流：

```text
.github/workflows/unsigned-ios-ipa.yml
```

它会在 macOS runner 上：

1. 安装依赖。
2. 运行 `npx expo prebuild --platform ios --clean --non-interactive`。
3. 安装 CocoaPods。
4. 使用 `xcodebuild` 构建 unsigned iPhone app。
5. 把 `.app` 打包成 unsigned `.ipa`。
6. 上传为 GitHub Actions artifact。

下载 artifact 后，用 Sideloadly 选择这个 `.ipa`，再用你的免费 Apple ID 签名安装。

## 使用步骤

1. 把项目推到 GitHub 仓库。
2. 打开 GitHub 仓库的 Actions 页面。
3. 选择 `Build unsigned iOS IPA`。
4. 点击 `Run workflow`。
5. 构建成功后，在 artifact 里下载：

```text
Lian-unsigned-ipa
```

6. 解压得到：

```text
Lian-unsigned.ipa
```

7. 打开 Sideloadly，选择这个 IPA，输入 Apple ID，安装到 iPhone。

## 注意事项

- Bundle ID 当前是 `com.ttan.exchat`。不要随便改，否则覆盖安装时数据不会沿用。
- 免费 Apple ID 签名通常 7 天有效。
- 过期后用 Sideloadly 重新签同一个 Bundle ID，正常情况下本地数据不会丢。
- 如果 GitHub Actions 构建失败，优先检查日志里的 CocoaPods、Xcode scheme 或 Expo prebuild 错误。

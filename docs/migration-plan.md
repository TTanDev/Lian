# Lian SwiftUI Migration Plan

## Product navigation

The root dock order is fixed:

1. 学习
2. 角色
3. 聊天
4. 模型
5. 我的

The default selected section is `聊天`.

## Architecture decisions

- UI: SwiftUI, targeting iOS 26.
- Persistence: SQLite through the native SQLite3 library.
- API keys: Keychain. Never store secrets in SQLite.
- Attachments: Copy imported images into Application Support and store relative paths in `chat_attachments`.
- Model image capability: Belongs to each API model, not global app state.

## Historical image invariant

The selected model's `supportsImages` value only controls whether new images can be selected and sent.
It must never hide or disable historical image rendering.

When rendering a historical attachment:

1. Load attachment metadata from `chat_attachments`.
2. Resolve its relative path below Application Support.
3. Verify the file exists before creating an image view.
4. Render the image when readable.
5. Render an explicit missing-image state when unavailable. Never leave an empty placeholder.

## Migration phases

- [x] Create native SwiftUI project skeleton.
- [x] Define root dock and default chat selection.
- [x] Define SQLite v1 schema.
- [x] Initialize SQLite during app startup.
- [x] Separate chat attachments from messages.
- [x] Add typed SQLite repositories and transactions.
- [x] Add Keychain-backed API credential storage.
- [x] Build model management and per-model image capability.
- [x] Build character list/editor.
- [x] Build chat list and conversation screen.
- [x] Build durable attachment import.
- [x] Build prompt builder and message sanitizer.
- [x] Migrate learning sources, memories, and proactive messages.
- [x] Build old Expo SQLite importer for characters, messages, attachments, learning data, and proactive messages.
- [x] Add unsigned IPA GitHub Actions workflow.
- [ ] Verify on-device keyboard animation and historical image rendering.

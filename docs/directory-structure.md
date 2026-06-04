# Directory Structure

```text
Lian/
  Lian/
    App/                  App entry point and global navigation state
    Core/
      API/                Model-provider requests and response parsing
      Database/           SQLite connection, schema, migrations, repositories
      Models/             Domain models shared between features
      Notifications/      Proactive-message scheduling
      Prompts/            Prompt construction and output sanitization
      Storage/            Keychain, files, and durable attachments
    DesignSystem/         Shared native UI styling and reusable controls
    Features/
      Learning/           Learning sources, memories, relationship knowledge
      Characters/         Character management
      Chat/               Conversation list, messages, input, attachments
      Models/             API model management and capabilities
      Profile/            App settings, backup, diagnostics
      Root/               Five-section root dock
    Resources/            Assets, localization, and Info.plist
  LianTests/              Unit tests
  LianUITests/            On-device interaction and keyboard tests
  docs/                   Architecture and migration notes
  project.yml             XcodeGen project definition
```

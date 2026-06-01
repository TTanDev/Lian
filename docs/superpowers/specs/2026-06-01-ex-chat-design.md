# Ex Chat Design

Date: 2026-06-01

## Goal

Build a private iOS chat app for personal use. The app lets the user create multiple "ex" characters, import materials about each person, generate an editable AI skill profile, and then chat with that character through an OpenAI-compatible API.

The app is not intended for App Store distribution. It will be developed on Windows, built through Expo/EAS, and installed with Sideloadly.

## Technical Direction

- Framework: Expo + React Native + TypeScript.
- Routing: expo-router.
- Local data: SQLite.
- API secrets: iOS secure storage through Expo SecureStore.
- File import: document picker and image picker.
- Notifications: iOS local notifications through Expo Notifications.
- Model protocol: OpenAI-compatible chat/multimodal API.
- API provider: user-configured Base URL, API key, and model name.

The app does not hard-code API credentials or a specific provider. It may default the protocol shape, but the user controls endpoint, key, and model, such as `mimo2.5`.

## Product Shape

The app should feel like a real chat app on the surface and a role training console underneath.

Main screens:

- Ex list: shows all ex characters, the latest message, relationship temperature, unread state, and proactive-message state.
- Chat: iMessage/WeChat-style bubbles, timestamps, text, images, stickers, and natural insertion of proactive messages.
- Ex details: avatar, nickname, relationship status, current emotion, relationship temperature, editable persona, shared memories, speech habits, triggers, and safety rules.
- Learning center: import texts, chat logs, screenshots, photos, stickers, social-media captures, and subjective descriptions. Run initial and incremental learning.
- Settings: API Base URL, API key, model, connection test, context limits, proactive-message settings, quiet hours, backup import/export.

## Privacy Model

Use privacy mode B:

- Raw materials stay on device by default.
- The app avoids sending the entire imported dataset to the API.
- Learning sends selected batches, summaries, or current multimodal inputs when needed.
- Generated skill profiles, memory summaries, chat records, and asset summaries are stored locally.
- API keys are stored in SecureStore and are not included in backups by default.

## Character Model

Each ex character has:

- Profile metadata: name, avatar, relationship state, creation date.
- Persona: how she speaks, reacts, jokes, gets angry, acts cute, or becomes distant.
- Shared memories: important events, places, relationship history, promises, conflicts, habits, and emotional anchors.
- Speech style: vocabulary, punctuation, emojis, stickers, reply length, rhythm, and common phrases.
- Emotional model: current mood, relationship temperature, recent events, unresolved tension.
- Triggers and boundaries: topics that make her upset, jealous, soft, distant, or affectionate.
- Correction history: user edits that teach the app what was inaccurate.

The profile is editable. The model produces the first draft, but the user can correct persona, memories, tone, and emotional rules.

## Learning Flow

Initial learning:

1. Create an ex character with name, avatar, relationship description, and current relationship state.
2. Import materials:
   - pasted text
   - chat logs
   - documents
   - screenshots
   - photos
   - stickers
   - social-media captures
   - subjective descriptions
3. Preprocess locally:
   - split text into chunks
   - classify assets by type
   - attach timestamps and source metadata when available
   - identify candidate high-value snippets
4. Send selected batches to the configured multimodal model.
5. Extract persona, speech habits, emotional patterns, shared memories, relationship clues, triggers, and sticker usage.
6. Merge batch results into a structured skill profile with source references and confidence notes.
7. Let the user review, edit, delete, or add corrections before chatting.

Incremental learning:

1. User adds new materials or a correction.
2. The app analyzes only the new material.
3. The model proposes changes to the existing profile.
4. The user can review and accept the merge.

The system should treat learning as ongoing profile maintenance, not one-time model training.

## Memory And Context Strategy

Do not send the full chat history on every request, even if a model supports very large context windows. Use a layered memory engine:

- Core profile: compact persona, speech style, relationship rules, and safety boundaries. Sent frequently.
- Shared memory: structured long-term relationship facts and important events. Sent selectively.
- Recent window: the latest raw messages, typically 20 to 50 messages.
- Relevant memory: memories retrieved by keyword, time, topic, entity, or importance.
- Time state: current time, last message time, reply delay, who spoke last, quiet hours, and missed replies.
- Emotional state: current mood, relationship temperature, unresolved conflict, recent positive or negative shifts.

When chat history grows, the app compresses older messages into episode summaries and memory updates. Full raw history remains in SQLite but is not always sent to the API.

Version 1 can use keyword, recency, and importance scoring for memory retrieval. Vector search can be added later.

## Chat Generation

When the user sends a message, the app builds a structured model request from:

- compact character profile
- selected shared memories
- relevant retrieved memories
- recent message window
- time and reply-delay context
- current emotional state
- user text and any attached images or stickers
- candidate stickers/assets the character may use

The model should return structured output, not only plain text. Example fields:

- message text
- optional sticker or image asset reference
- mood change
- relationship temperature delta
- memory updates
- flags for whether a user correction may be useful

The app then:

- displays the reply as a chat bubble
- inserts selected sticker or image assets
- updates emotion and relationship temperature
- stores any approved or auto-accepted memory update
- triggers compression when needed

## Time Awareness

Timestamps are first-class data.

Every message should store:

- message id
- role: user, assistant, system, imported
- content
- created timestamp
- optional delivered timestamp
- optional read timestamp
- source: normal, proactive, imported, learning
- optional asset references

The model context should describe reply delays naturally, for example:

- user replied 3 hours and 34 minutes later
- assistant sent the last message and user did not reply
- current local time is late night

The character should consider late replies according to her persona. The model must not mechanically complain every time; it should decide based on mood, relationship state, and recent conversation.

## Images And Stickers

The app supports images and stickers as user input, learning material, and assistant output.

User input:

- User can send images, screenshots, and stickers in chat.
- If the configured model supports multimodal input, current images can be sent in the request.
- The app stores local asset references and generated summaries.

Learning:

- Chat screenshots are used to infer real tone, emojis, timing, and reply rhythm.
- Photos are used to infer events, places, and contextual memories.
- Social-media captures are used to infer public persona, interests, and wording.
- Stickers are classified by mood, usage context, and whether they are characteristic.

Assistant output:

- Version 1 does not generate new images.
- The assistant can choose from local saved stickers or images learned for that ex.
- The model can return an asset suggestion by `asset_id`, mood, or usage context.

The app should not generate realistic photos of the person, perform face swapping, or create impersonation images.

## Proactive Messages

No cloud push notifications. No APNs dependency. No paid Apple Developer Program requirement.

Use local notifications only:

1. When the app is opened, generate a queue of future proactive messages for the next 1 to 3 days.
2. Store the queue locally.
3. Schedule iOS local notifications.
4. When the user taps a notification, insert that proactive message into the chat history.
5. Refill the queue when the user opens the app again.

Proactive messages consider:

- current time
- quiet hours
- recent conversation
- whether the user left her unanswered
- last speaker
- relationship temperature
- current mood
- whether they recently argued
- whether the character is likely to initiate contact

Version 1 proactive controls:

- on/off
- frequency: low, medium, high
- quiet hours
- manual "let her say something first" action

The app should not rely on background tasks for precise AI generation, because iOS background execution is not reliable as a timer.

## Safety Boundaries

The character should feel realistic, not sanitized. Allowed behavior includes:

- being cold
- being affectionate
- being jealous
- being sarcastic
- acting cute
- complaining about late replies
- expressing hurt or anger

Hard limits:

- no suicide threats
- no encouragement of self-harm
- no extreme coercive control
- no sustained humiliation or threats
- no instructions that endanger the user or others

These rules are part of the runtime prompt and profile structure.

## Backup And Restore

Support local export and import of an ex character backup.

Suggested file extension: `.exchat`.

Backup includes:

- character profile
- chat history
- memory summaries
- emotional state
- learning summaries
- sticker and asset metadata
- optionally copied local asset files

Backup excludes by default:

- API key
- provider credentials

Future versions can add password-based encryption for backup files.

## Version 1 Scope

Version 1 includes:

- create multiple ex characters
- ex list
- chat UI with timestamps
- OpenAI-compatible API configuration
- text chat with time-delay awareness
- multimodal input support where model/provider supports it
- import text, files, screenshots, photos, stickers, and social captures
- generate and edit ex skill profile
- layered memory engine to avoid context explosion
- local sticker selection in AI replies
- local proactive-message queue and notifications
- export/import character backup

Version 1 excludes:

- cloud sync
- account system
- App Store distribution
- APNs/cloud push
- real-time background AI generation
- face swapping
- realistic generated photos of the person
- true model fine-tuning

## Implementation Defaults

- API payload: start with OpenAI Chat Completions-compatible messages because it is the broadest compatibility target. Add a provider adapter only if the configured endpoint requires small shape differences.
- Multimodal input: support OpenAI-compatible image content blocks when the configured model/provider accepts them. If a provider rejects images, keep image summaries and ask the user to switch models for image understanding.
- Local database: use Expo SQLite unless implementation testing shows a blocker.
- Backup encryption: Version 1 supports export/import without API keys. Password encryption is a follow-up unless the user asks to include it in the first build.
- Visual direction: iMessage/WeChat-style chat with Liquid Glass-inspired translucent surfaces, soft highlights, and floating controls.

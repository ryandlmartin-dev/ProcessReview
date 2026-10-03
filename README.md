# Pocket Notes

A Plaud-style voice notes app for Android that runs **entirely on your phone**. Record a meeting, a walk-and-talk brain-dump or a process walkthrough, and get back:

- a transcript (Whisper, on-device)
- a title, summary, key points, decisions and tags (local LLM via llama.cpp)
- **action items** you can turn into **reminders** with one tap
- **reports** on demand: meeting minutes, process review, follow-up email, action plan, executive brief, thought organiser, or your own custom prompt

No account, no subscription, nothing uploaded. An optional **"Deep report with Claude"** sends a single transcript to Claude when you want higher-quality output, using your own API key and only when you tap it.

## How it works

```
Mic ──► native recorder (Kotlin foreground service, 16 kHz WAV, 30 s segments)
          │
          ├─► whisper.rn: transcribes each segment while you're still talking
          │
          └─► llama.rn: transcript → JSON {title, summary, key_points, action_items, decisions, tags}
                         (long recordings: chunked map → merge)
                             │
                             ├─► SQLite (notes, action items, reports)
                             ├─► expo-notifications (reminders)
                             └─► reports (on-device, or Claude if you choose)
```

| Folder | What's there |
| --- | --- |
| `src/app/` | Screens (Expo Router): home/to-dos, recording, note, report, settings |
| `src/lib/pipeline.ts` | Recording session → live transcription → AI organisation |
| `src/lib/llm.ts` | Local LLM: structured note extraction and report generation |
| `src/lib/transcriber.ts` | Whisper context management |
| `src/lib/prompts.ts` | Extraction prompt, JSON schema and report templates (edit these to tune output) |
| `src/lib/cloud.ts` | Optional Claude report |
| `modules/pocket-recorder/` | Native Android recorder: background-safe mic capture and WAV segmenting |

## Install on your phone (no Android Studio needed)

1. Every push runs the **Android APK** GitHub Action (`.github/workflows/android.yml`).
2. Open the repo on GitHub → **Actions** → the latest **Android APK** run → download the **pocket-notes-apk** artifact (a zip containing the `.apk`).
3. Copy the APK to your phone and open it (allow "install unknown apps" for your browser or file manager when Android asks).
4. Open the app → **Settings** → download a speech model (Whisper Base, 148 MB) and an AI model (Qwen3 1.7B, ~1.1 GB). Use Wi-Fi; this happens once.
5. Back on the home screen, tap **Record**.

Phone requirements: Android 7+, arm64. **4 GB RAM** for Qwen3 1.7B, **8 GB+** for Qwen3 4B (much better reports).

## Develop locally

```bash
npm install
npm run typecheck && npx expo lint && npm test
npx expo run:android        # needs Android Studio / SDK, a device or emulator
```

The app uses custom native code, so it cannot run in Expo Go. Use a development build (`npx expo run:android`) or the CI APK.

## Costs

On-device use costs nothing. The optional Claude reports are billed per use by Anthropic (separate from a Claude.ai subscription): roughly **5–10¢ per hour-long recording** with Claude Opus 5.5, about half that with Sonnet 5.5. Requests opt in to Anthropic's server-side refusal fallback (`fallbacks: "default"`), so if a safety classifier declines one, the API retries it on a fallback model.

## Roadmap

- [ ] Ask questions across all notes (on-device embeddings + search)
- [ ] Speaker labels (who said what)
- [ ] Home-screen widget / quick-settings tile for one-tap recording
- [ ] Calendar export for dated action items
- [ ] Bluetooth clip-on recorder (ESP32-S3 + MEMS mic) that syncs into the app
- [ ] iPhone build (Apple on-device models)

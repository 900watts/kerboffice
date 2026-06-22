# KerbOffice

**AI-native work management platform with Kerbal agents.** Your dev team is a squad of green-suited personalities from the KSC — they banter, they go on break, they ask questions, and they answer yours. Bring your own AI provider, or run Ollama locally.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Electron](https://img.shields.io/badge/electron-28-9feaf9)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Highlights

- **Real AI chat with personality** — Each kerbal (Jeb, Bill, Valentina, Bob, Wernher, Gene, Walt, Mortimer, Linus, Bobak) has a soul file that drives their voice. They answer in character.
- **Idle banter & proactive check-ins** — When you're away, kerbals chat with each other in the background, just like a real office.
- **Multi-provider AI** — Bring your own API key: **OpenRouter, OpenAI, Google Gemini, Silicon Flow, Ollama (local)**, or register your own plugin provider.
- **Smartphone-style phone UI** — Off-shift kerbals respond through DMs on the in-app phone, with morning briefings and evening recaps.
- **Mood system** — Mood state machine drives kerbal behavior, dialogue tone, and chat receptivity.
- **Memory & facts** — Each kerbal remembers past interactions and extracts durable facts about you.
- **Cross-platform desktop** — Single binary, no installer needed, works fully offline once built.

---

## Quick Start (Windows)

1. Download the latest `KerbOffice-0.1.0-win32-x64.zip` from the [Releases](../../releases) page.
2. Extract to any folder.
3. Run `KerbOffice.exe`.
4. Open the phone (right side of the room) → Settings → AI Provider.
5. Pick **Ollama (Local)** if you have Ollama running, or paste an API key for any cloud provider.
6. Send a message in the chat bar — talk to the kerbals.

For macOS / Linux: build from source (see below).

---

## Build from Source

Requires Node.js 22+ and npm.

```bash
git clone https://github.com/YOUR_USERNAME/kerboffice.git
cd kerboffice
npm install
npm run package
```

The packaged EXE will be at `release/KerbOffice-win32-x64/KerbOffice.exe`. The full process bundles the Vite frontend, the Electron main process, and all assets into a single ~140 MB asar archive.

To run in dev mode (with hot reload):

```bash
npm run dev                # Vite dev server
npm run electron:dev       # Launches Electron pointing at the dev server
```

---

## Architecture

```
+----------------+    IPC     +-------------------+    fetch    +-------------------+
|  Renderer      |  <------>  |  Electron Main    |  <------>   |  AI Provider      |
|  (React/Vite) |  context-   |  (Node.js)        |  IPC proxy  |  (Ollama / API)   |
|                |  bridge    |                   |             |                   |
+----------------+            +-------------------+             +-------------------+
       |                              |
       | localStorage                 | fs (app.asar + userData)
       v                              v
  - chat history               - bundled .md souls
  - user profile               - agent memory/mood
  - AI config + keys           - generated reports
  - banter config              - main.log (debug)
```

**Why IPC for fetch?** The Electron renderer loads from `file://` (via `loadFile`), and Chromium blocks HTTPS `fetch` from `file://` origins. All external AI API calls go through the main process via an `ai:fetch` IPC handler.

**Why IPC for soul files?** Same reason — `fetch('/kerbal-souls/gene.md')` doesn't resolve on `file://`. The `kerbal-soul:read` IPC reads them straight from the asar.

---

## AI Provider Setup

### Ollama (Local — free, recommended)

1. Install [Ollama](https://ollama.com).
2. Pull a model: `ollama pull llama3.2` (or any other).
3. In KerbOffice Settings, pick **Ollama (Local)** and enter the model name.
4. Ollama must be running on `127.0.0.1:11434` when you launch KerbOffice.

If you don't configure any provider, KerbOffice will auto-detect Ollama as a fallback. You'll see a warning in Settings when no key is set for the selected provider.

### OpenRouter (Free + paid models)

1. Get an API key at <https://openrouter.ai/keys>.
2. In Settings, pick **OpenRouter**, paste the key.
3. Pick a model from the dropdown or type a custom one (e.g. `meta-llama/llama-3.3-70b-instruct:free`).

### Google AI / OpenAI / Silicon Flow

Same pattern: pick the provider, paste your key, choose a model.

### Custom plugin providers

Use the **Plugin Registry** in Settings to register your own OpenAI-compatible endpoints (e.g. self-hosted models).

---

## Project Structure

```
src/
  App.tsx                          # Root entry
  kerbal-control/                  # Core kerbal system
    MissionControl.tsx             # Main scene
    KerbalStore.ts                 # Zustand store for kerbal state
    SoulLoader.ts                  # Loads .md soul files
    ShiftDefaults.ts               # Single source of truth for shifts
    KerbalMemory.ts                # Per-kerbal memory + auto-compaction
    MoodSystem.ts                  # 7-level mood state machine
    StoryEngine.ts                 # Personal narrative arc per kerbal
    AgentSkills.ts                 # Web search, URL fetch, time tools
    ProactiveAgent.ts              # Background behavior loop
    UserProfile.ts                 # "About me" profile injected into prompts
    Room/
      RoomCanvas.tsx               # Pixi.js scene
      KerbalSprite.ts              # Procedural Kerbal sprite
      RoomLayout.ts                # Building layout constants
    Chat/
      ChatBar.tsx                  # Main chat input + history
      MessageRouter.ts             # @mention / name / keyword routing
      SmartphoneModal.tsx          # Off-shift DM phone UI
      IdleBanter.ts                # Kerbal-to-kerbal banter
  services/
    ai.ts                          # Multi-provider AI router
    i18n.ts                        # EN / ZH / JA translations
  public/kerbal-souls/             # Bundled .md personality files
electron/
  main.ts                          # App entry, window setup, event logging
  preload.ts                       # contextBridge surface
  ipc-handlers.ts                  # All ipcMain.handle handlers
```

---

## Internationalization

Three languages ship: **English**, **中文 (简体)**, **日本語**. Switch in Settings → Language. Adding a new locale: add a key block to `src/services/i18n.ts` and a toggle button in `SmartphoneModal.tsx`.

---

## Diagnostics

If something goes wrong, the main process writes a rolling log to:

- **Windows**: `%APPDATA%\kerboffice\main.log`
- **macOS**: `~/Library/Application Support/kerboffice/main.log`
- **Linux**: `~/.config/kerboffice/main.log`

The log includes main-process events, all IPC `ai:fetch` calls, all `kerbal-soul:read` calls, and a mirror of the renderer's console output. Useful for debugging "Failed to fetch" and similar issues.

---

## Known Quirks

- **Ollama IPv6**: This app uses `127.0.0.1`, not `localhost`, for Ollama. Node's fetch inside Electron sometimes picks IPv6 `::1` first, which breaks against IPv4-only local servers.
- **First-run no-provider**: If no API key is set, the app auto-falls back to Ollama if it's running. Look for the orange warning banner in Settings.
- **localStorage keys**: Internal keys (`ksc_ai_*`, `kerbal-control:*`, `ksc_user_profile`) keep the legacy `ksc_` / `kerbal-control` prefixes for backward compatibility with prior installs. Renamed product, not data.

---

## License

MIT — see [LICENSE](./LICENSE).

Built with: React 18, Vite 6, Pixi.js 8, Electron 28, Zustand 5, sql.js, Tailwind 4.

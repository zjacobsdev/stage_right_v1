<p align="center">
  <img src="assets/public_speaking_thumbnail.png" alt="PracticePal cover" style="width:100%;max-width:1100px;height:160px;object-fit:cover;border-radius:8px;" />
</p>

# Stage Right — Public Speaking & Interview Trainer

A lightweight, client-side demo web app that simulates a Zoom-like practice environment for public speaking and interview prep — built to be operated with voice and simple hand gestures (no mouse/keyboard required).

- Built with MediaPipe · Tailwind · Web Speech API

- Used AI AssistantS
  - Copilot (GPT-5 mini)- build the web application with MediaPipe, Tailwind and Web Speech API.
  - ShutterStock AI- ReadMe.md headline photo generation

## Quick Tips & Hand Gestures

Quick practical instructions to get started fast and how the gesture controls work (placed here for easy discovery):

- Recommended browser: use a Chromium-based browser (Chrome or Edge) for best Web Speech API support and MediaPipe performance.
- Allow camera and microphone when prompted — the app runs entirely in your browser and no data leaves your machine.
- Hand gestures (hold for ~3 seconds to trigger):
  - Open palm → Start session
  - Fist → Stop session
  - Thumbs up → Save session
  - Point (index finger) → Hold to enter scroll mode; move up/down to scroll notes.

Tips for reliable detection:

- Sit in front of the camera with good lighting and keep your face visible for the best "View" status and gesture reliability.
- If speech transcription doesn't start automatically, click "Start Session" (this provides the user gesture browsers need to enable recognition).
- Use the mic-level badge to confirm your microphone is receiving audio — it shows a small percentage indicating input level.


## Table of contents

<p align="center">
  <a href="https://stageright-mvp.netlify.app/" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#6366f1;color:white;text-decoration:none;font-weight:600">▶ Live Demo — Open in browser</a>
</p>

- [Quick overview](#quick-overview)
- [Features](#features)
- [Quickstart](#quickstart)
- [Usage](#usage)
  - [Start a session](#start-a-session)
  - [Quick tips & hand gestures](#quick-tips--hand-gestures)
  - [Hand gestures](#hand-gestures)
  - [Notes & on-topic detection](#notes--on-topic-detection)
  - [Saving & sessions](#saving--sessions)
- [Development](#development)
- [Testing & QA notes](#testing--qa-notes)
- [Security & privacy](#security--privacy)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## Quick overview

PracticePal is a static demo that helps users rehearse speaking tasks. It uses the browser camera and microphone to provide:

- Live camera view with face & hand tracking (MediaPipe).
- Automatic speech transcription and filler-word detection (Web Speech API).
- Lighting check and simple user-in-frame heuristics.
- Hand gestures to control UI (scroll notes, start/stop).
- Voice commands for common controls.
- Session persistence in `localStorage`, with export-to-JSON/CSV.

This project is a demo: it intentionally avoids server infrastructure and uses browser APIs to keep everything local and simple.

## Features

- Camera view with MediaPipe FaceDetection & Hands for presence and gesture controls
- Lighting check (simple brightness sampling)
- Speech recognition (Web Speech API): live transcript, WPM, filler-word counts
- On-topic detection: simple keyword overlap between notes and speech
- Timer and WPM guidance; configurable goal time
- Four note presets (prepopulated)
- Voice commands: "start", "stop", "mute", "unmute", "scroll up", "scroll down", etc.
- Hand gestures (heuristics): open palm, fist, thumbs up, point to scroll
- Sessions saved to `localStorage` and viewable/exportable from `session.html`
- Accessibility: ARIA labels, aria-live region for announcements, large controls

## Quickstart

Open the project in a Chromium-based browser (Chrome or Edge recommended for best Web Speech API support).

1. Serve the directory (browsers often block camera/mic access on file://). From the project root:

```bash
cd /home/zah_zah/goose_no_keyboard_hackathon
python3 -m http.server 8000
```

2. Open the demo:

- http://localhost:8000/index.html — main practice UI
- http://localhost:8000/session.html — saved sessions viewer

Notes:
- Use a Chromium-based browser for the best speech recognition experience.
- Allow camera and microphone access when prompted.

## Usage

### Start a session

- Choose a note preset from the sidebar.
- Click "Start Session" or say "start".
- Speak naturally. The app will show a live transcript, WPM, filler-word counts, and highlight matched keywords from your selected notes.

### Quick Tips & Hand Gestures

Quick practical instructions to get started fast and how the gesture controls work (placed here for easy discovery):

- Recommended browser: use a Chromium-based browser (Chrome or Edge) for best Web Speech API support and MediaPipe performance.
- Allow camera and microphone when prompted — the app runs entirely in your browser and no data leaves your machine.
- Hand gestures (hold for ~3 seconds to trigger):
  - Open palm → Start session
  - Fist → Stop session
  - Thumbs up → Save session
  - Point (index finger) → Hold to enter scroll mode; move up/down to scroll notes.

Tips for reliable detection:

- Sit in front of the camera with good lighting and keep your face visible for the best "View" status and gesture reliability.
- If speech transcription doesn't start automatically, click "Start Session" (this provides the user gesture browsers need to enable recognition).
- Use the mic-level badge to confirm your microphone is receiving audio — it shows a small percentage indicating input level.


These are heuristics and intentionally simple — not a production-grade sign-language model.

### Notes & on-topic detection

- Select one of the notes presets on the sidebar.
- The app detects spoken words and highlights words that overlap with the chosen notes.
- This uses simple keyword overlap — no embeddings or semantic matching.

### Saving & sessions

- Stop the session and click "Save session" to persist the session in `localStorage`.
- Open `session.html` to review saved sessions.
- Sessions can be exported per-session or as an export-all operation (JSON or CSV).
- Export format: minimal JSON containing timestamps, transcript, counts (see `session.html` for details).

## Development

This is a static front-end demo. To run locally:

1. Install nothing special — just a static server or Python's built-in server:

```bash
# from the repo root
python3 -m http.server 8000
```

2. Visit `http://localhost:8000/index.html`.

3. Edit files:
- `index.html` — app shell and layout
- `js/app.js` — main UI logic, MediaPipe & speech integration
- `js/sessions.js` — session persistence / export logic
- `session.html` — saved-sessions viewer

Open the folder in your editor (VS Code recommended) and reload the browser after edits.

## Testing & QA notes

Manual smoke tests recommended:

- Camera & microphone permission flow.
- Lighting check behavior under low-light conditions.
- Speech recognition: try speaking slowly/quickly, use filler words ("um", "uh") and verify counts.
- Voice commands: say "start", "stop", "scroll up/down".
- Hand gestures: open palm / fist / thumb up and observe UI responses.
- Session save/load: save a session and confirm it appears in `session.html`.
- Export: export a session to JSON/CSV and validate structure.

Edge cases to consider:
- Browser without Web Speech API (fallback: no transcript).
- Camera or mic denied by user.
- No hands or face visible (gesture or presence features will be disabled).
- Large transcripts or very long sessions (localStorage size limits).

## Security & privacy

- No data is sent to any server. Sessions are stored locally in your browser's `localStorage`.
- Speech transcription is handled by the browser's Web Speech API — check your browser vendor for voice data handling and privacy policies.
- Camera & microphone access are requested by the browser and can be revoked at any time via browser controls.

## Contributing

This is a demo project; contributions are welcome. When contributing:

- Open an issue to discuss major changes.
- Create small, focused PRs for bug fixes or feature additions.
- Prefer accessible changes and keep the demo runnable without any secret keys or server components.

Suggested follow-ups (low-risk improvements):
- Add unit/integration tests for `js/sessions.js` persistence logic.
- Improve on-topic detection with embeddings (opt-in model).
- Add more robust gesture mapping or integrate a lightweight sign-language model.
- Add ability to persist sessions to a server (opt-in).

## License

MIT — see `LICENSE` (if not present, add a LICENSE file with MIT text).

## Acknowledgements

- MediaPipe — face & hand detection via CDN
- Web Speech API — browser transcription
- Tailwind CSS — UI utilities via CDN
- Demo inspired by accessibility-first and low-interaction design patterns


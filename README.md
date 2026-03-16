# ✨ Explain Anything — AI-Powered Camera Vision Assistant

> Point your camera at anything. Understand everything — in your language.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-orange?style=flat-square&logo=google)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)

---

## 🧠 What Is This?

**Explain Anything** is a real-time AI vision assistant that uses your device's camera to capture the world around you and instantly explains, solves, translates, or styles what it sees — spoken aloud in your chosen language.

Built with **Next.js**, **Google Gemini 2.5 Flash**, and browser-native speech APIs, it works entirely in the browser with no login required.

---

## ✨ Features

### 🚀 Core Actions

| Button | What It Does |
|--------|-------------|
| **Explain** | Captures a frame and explains what Gemini sees in 3–4 sentences |
| **Solve** | Detects math problems or code and returns numbered step-by-step solutions |
| **Translate** | Reads all visible text in the image and translates it to your selected language |
| **Style** | Analyzes clothing in the frame and suggests 2 complete outfit combinations |

### 🔴 Live Mode
Toggle continuous scanning — captures a new frame every 6 seconds and narrates what it sees in one sentence. No button pressing needed.

### 🎯 Scan Modes
Overlays a specialized focus on top of the Explain action:

| Mode | Focus |
|------|-------|
| General | Default all-purpose explanation |
| Ingredients | Identifies food items, allergens, nutritional highlights |
| Hazards | Safety expert mode — spots risks and dangers |
| Study | Tutor mode — key concepts and educational context |
| Translate | Detects and translates all visible text |

### 🌐 Language Support
All AI responses, voice output, and speech recognition switch together:
- **नेपाली** (Nepali)
- **हिंदी** (Hindi)
- **English**

### 📊 Difficulty Levels

| Level | Style |
|-------|-------|
| ELI5 | Simple, fun, child-friendly language |
| Student | Clear educational explanations with concepts |
| Expert | Highly technical, detailed, and precise |

### 👗 Outfit Generator
- Analyzes clothing items visible in the camera frame
- Returns 2 outfit suggestions with occasion and styling tip
- Extracts clothing keywords as tappable pill buttons
- Each pill opens Google Images for that specific item
- "See Full Outfit Inspiration" combines top 3 items into one search

### 💬 Conversation Memory
The last 6 messages from chat history are sent with each request so Gemini understands follow-up questions in context.

### ↔️ Resizable Panels
Drag the divider between the chat panel and the camera panel to resize them horizontally to your preference.

---

## 🏗 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| AI Model | Google Gemini 2.5 Flash (vision + text) |
| Styling | Tailwind CSS v4 |
| Speech Output | Web Speech Synthesis API |
| Voice Input | Web Speech Recognition API |
| Camera | `navigator.mediaDevices.getUserMedia` |
| Image Capture | HTML Canvas API |

---

## 📁 Project Structure

```
explain-anything/
├── app/
│   ├── page.tsx              # Main UI — camera, chat, controls, overlays
│   └── api/
│       └── explain/
│           └── route.ts      # API route — Gemini integration + prompt logic
├── public/                   # Static assets
├── .env.local                # GEMINI_API_KEY (not committed)
├── next.config.ts            # Next.js configuration
├── postcss.config.mjs        # Tailwind CSS v4 config
└── package.json              # Dependencies
```

---

## ⚙️ How It Works

### Frontend (`page.tsx`)

1. On load, `getUserMedia` requests the rear-facing camera at 1280×720 and streams it into a `<video>` element
2. A hidden `<canvas>` sits alongside — used only for frame capture, never shown to the user
3. When any action button is pressed, `captureFrame()` draws the current video frame onto the canvas and exports it as a base64 JPEG string at 0.8 quality
4. The base64 image, question text, difficulty level, scan mode, language, and conversation history are sent via `POST` to `/api/explain`
5. The response text is added to the chat history and immediately read aloud via the browser's `SpeechSynthesisUtterance` API

### Backend (`route.ts`)

The API route builds a `systemInstruction` string in composable layers:

```
Base role  (difficulty level)
  + Language instruction
    + Mode instruction  (explain / solve / translate / outfit / live)
      + Scan mode focus  (ingredients / hazards / study / translate)
        + Length constraint
          + Follow-up question  (explain mode only)
```

If `conversationHistory` is provided, it constructs a multi-turn `contents[]` array mapping `"ai"` → `"model"` for Gemini's expected role format, and calls `model.generateContent({ contents })`. Otherwise it uses the simpler single-turn call.

### Prompt System Design

Each mode gets a tailored system prompt rather than modifying a shared one:

| Mode | Prompt Strategy |
|------|----------------|
| `explain` | Role + language + scan focus + "3–4 sentences max" + follow-up question |
| `solve` | "Show ALL steps clearly numbered. If math, solve completely. If code, explain each line." |
| `translate` | "Original text first, then translate. Format: Original: ... \| Translation: ..." |
| `outfit` | Strict structured format — Detected / Suggestion 1 / Suggestion 2 / Color Advice |
| `live` | "ONE sentence only. Maximum 20 words. Be direct." |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A free Google Gemini API key — get one at [aistudio.google.com](https://aistudio.google.com) (no credit card required)
- Chrome is recommended for full Web Speech API support

### Installation

```bash
# Clone the repository
git clone https://github.com/Shinigami1593/CameraScanExplainsEverything
cd CameraScanExplainsEverything

# Install dependencies
npm install

# Add your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env.local

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser and allow camera access when prompted.

### Environment Variables

| Variable | Required | Where to Get It |
|----------|----------|-----------------|
| `GEMINI_API_KEY` | ✅ Yes | [aistudio.google.com](https://aistudio.google.com) — free |

---

## 📱 Usage Guide

1. **Allow camera access** when the browser prompts you
2. **Pick your language** using the pill buttons on the top-left — नेपाली / हिंदी / English
3. **Pick a difficulty** on the top-right — ELI5 / Student / Expert
4. **Pick a scan mode** on the second row right — General / Ingredients / Hazards / Study / Translate
5. **Point your camera** at whatever you want to understand
6. **Tap an action:**
   - ⚪ Big white button → **Explain** what the camera sees
   - 🎤 Mic button → **Ask a voice question** about what you see
   - 🔢 **Solve** a math problem or code snippet
   - 🌐 **Translate** all text visible in the image
   - 👗 **Style** — get outfit suggestions from your clothing
   - 🔴 **Live** toggle → continuous one-sentence narration every 6 seconds

---

## ⚠️ Known Limitations

- Speech Recognition works best in **Chrome** — Firefox has limited Web Speech API support
- `ne-NP` (Nepali) voice may fall back to `hi-IN` (Hindi) or English depending on the voices installed on the device
- Live mode fires every 6 seconds — if Gemini responds slowly, requests may queue up briefly
- Outfit keyword pill extraction depends on Gemini consistently following the structured response format

---

## 🔮 Roadmap

- [ ] Streaming responses — text types out word by word as Gemini generates it
- [ ] Structured JSON output — render confidence scores and tags as UI components
- [ ] Save scan history — persist past captures and explanations to `localStorage`
- [ ] PWA support — installable on Android and iOS as a home screen app
- [ ] Text input box — type questions as an alternative to voice input

---

## 📄 License

MIT — free to use, modify, and build on.
# ✨ Explain Anything — AI-Powered Vision Assistant

> Point your camera at anything. Understand everything.

---

## 🎯 What Is This?

**Explain Anything** is a real-time AI vision assistant built with Next.js and Google Gemini 2.5 Flash. It uses your device camera to capture the world around you and instantly explains, solves, translates, or styles what it sees — in your language.

---

## 🚀 5-Minute Presentation Script

### ⏱ Minute 1 — The Problem (Business POV)

> "Every day, people encounter things they don't understand — a math problem, a food label in a foreign language, a safety hazard, an outfit they want to recreate. Searching Google takes time, requires you to describe what you see in words, and often gives irrelevant results.
>
> What if you could just **point your camera** and instantly get an expert explanation — in your own language?"

**Pain points this solves:**
- Students struggling with complex problems in textbooks
- Tourists unable to read foreign signs or menus
- People unsure if something is safe or dangerous
- Fashion-conscious users wanting styling advice on the go
- Anyone in Nepal or India who wants AI explanations in Nepali or Hindi — not just English

---

### ⏱ Minute 2 — The Demo (Show, Don't Tell)

**Live demo flow — do these in order for maximum impact:**

1. **Open the app** — camera loads instantly, show the clean UI
2. **Point at something on the table** → hit 🚀 Explain → show the short, spoken explanation
3. **Switch to Hazards mode** → point at something electrical or cluttered → show safety analysis
4. **Point at a math problem** → hit 🔢 Solve → show step-by-step solution
5. **Point at any text** → hit 🌐 Translate → switch language to नेपाली → show Nepali output
6. **Point at your own outfit** → hit 👗 Style → show outfit suggestions + tap a Google Images pill
7. **Toggle 🔴 Live mode** → wave camera around → show continuous real-time narration

> "Everything you just saw took under 30 seconds each. No typing. No searching. Just point and understand."

---

### ⏱ Minute 3 — How It Works (Technical POV)

**Architecture in one sentence:**
> Next.js frontend captures camera frames → sends base64 image + context to a Next.js API route → Google Gemini 2.5 Flash analyzes vision + text → response spoken aloud via Web Speech API.

**Tech Stack:**
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| AI Model | Google Gemini 2.5 Flash (vision) |
| Styling | Tailwind CSS v4 |
| Speech Output | Web Speech Synthesis API |
| Voice Input | Web Speech Recognition API |
| Camera | `navigator.mediaDevices.getUserMedia` |
| Image Capture | HTML Canvas API |

**Key technical decisions:**

- **Gemini 2.5 Flash** chosen over GPT-4o for cost efficiency and speed — handles both vision and text in a single API call
- **Base64 JPEG at 0.8 quality** strikes the balance between image clarity and payload size
- **Conversation history** (last 6 messages) sent with each request so Gemini has context for follow-up questions
- **System prompt layering** — difficulty level sets the base tone, scan mode appends specialized focus, language appends output language — all composable
- **Resizable panels** built with native mouse/touch event listeners — no library needed
- **No image generation API needed** — outfit visuals use Google Images search links, keeping cost at zero

---

### ⏱ Minute 4 — Features Breakdown

#### 🔍 Core Modes
| Feature | What It Does |
|---|---|
| **Explain** | Captures frame → Gemini explains in 3-4 sentences |
| **Solve** | Detects math/code → shows numbered step-by-step solution |
| **Translate** | Reads all text in image → translates to selected language |
| **Style** | Analyzes clothing → suggests 2 outfits + Google Images links |
| **Live Mode** | Auto-captures every 6 seconds → continuous 1-sentence narration |

#### 🎯 Scan Modes (overlays on Explain)
`General` · `Ingredients` · `Hazards` · `Study` · `Translate`

#### 🌐 Language Support
`नेपाली (Nepali)` · `हिंदी (Hindi)` · `English`
— Voice input, AI response, and speech output all switch language together

#### 📊 Difficulty Levels
`ELI5 (Explain like I'm 5)` · `Student` · `Expert`

#### 👗 Outfit Generator
- Detects clothing items in frame
- Suggests 2 complete outfit combinations with occasion + styling tip
- Extracts keywords → renders as tappable pills
- Each pill opens Google Images for that item
- "See Full Outfit Inspiration" combines top 3 items into one search

---

### ⏱ Minute 5 — Business Case & Impact

**Target Users:**
- 🎓 **Students** — solve problems from textbooks instantly
- 🌏 **Travelers** — translate signs, menus, labels in real time
- 👷 **Workers** — identify hazards before accidents happen
- 👗 **Fashion enthusiasts** — get styled without a personal stylist
- 🇳🇵 **Nepali/Hindi speakers** — access AI in their native language

**Market Opportunity:**
- Nepal has ~30 million people — very few AI tools support Nepali natively
- Visual AI assistants are a $2.3B market growing at 35% annually
- No direct competitor combines vision + multilingual speech + outfit styling in one free tool

**Why This Wins:**
1. **Zero friction** — no login, no upload, just point and tap
2. **Multilingual first** — built for South Asian users, not retrofitted
3. **Genuinely useful today** — not a concept, a working product
4. **Extensible** — every new Gemini capability (audio, video) slots straight in

---

## 🛠 Setup & Running Locally

```bash
# Clone the repo
git clone https://github.com/Shinigami1593/CameraScanExplainsEverything
cd CameraScanExplainsEverything

# Install dependencies
npm install

# Add your Gemini API key
# Create a .env.local file:
echo "GEMINI_API_KEY=your_key_here" > .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome (recommended for full Speech API support).

> **Get a free Gemini API key:** [aistudio.google.com](https://aistudio.google.com) — no credit card required.

---

## 📁 Project Structure

```
explain-anything/
├── app/
│   ├── page.tsx          # Main UI — camera, controls, chat, overlays
│   └── api/
│       └── explain/
│           └── route.ts  # API route — Gemini integration, prompt logic
├── public/               # Static assets
├── .env.local            # GEMINI_API_KEY (not committed)
├── next.config.ts        # Next.js config
├── tailwind.config       # Tailwind CSS v4
└── package.json          # Dependencies
```

---

## 🔑 How the AI Prompt System Works

Every API call builds a `systemInstruction` string in layers:

```
Base role (difficulty)
  + Language instruction
    + Mode instruction (solve / translate / outfit / live)
      + Scan mode focus (ingredients / hazards / study)
        + Length constraint (3-4 sentences for regular explain)
          + Follow-up question (for explain mode only)
```

This composable design means adding a new mode is just adding one `else if` block — no restructuring needed.

---

## 🌐 API Route Logic Summary (`route.ts`)

```
POST /api/explain
  ├── Validates image + API key
  ├── Builds systemInstruction (difficulty + language + mode + scanMode)
  ├── If conversationHistory exists → uses multi-turn generateContent({contents})
  └── Else → uses single-turn generateContent([prompt, image])
```

**Conversation history** maps chat roles:
- `"ai"` → `"model"` (Gemini's expected role name)
- `"user"` → `"user"`

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | From [aistudio.google.com](https://aistudio.google.com) — free |

---

## 🚧 Known Limitations

- Speech Recognition works best in **Chrome** — Firefox has limited support
- `ne-NP` (Nepali) voice may fall back to Hindi (`hi-IN`) or English depending on the device's installed voices
- Live mode fires every 6 seconds — rapid movement may result in overlapping API calls if Gemini responds slowly
- Outfit keyword extraction depends on Gemini following the structured format — occasional variations may reduce pill count

---

## 🔮 What's Next (Post-Hackathon Roadmap)

- [ ] Streaming responses — text types out word by word instead of appearing all at once
- [ ] Structured JSON output — tags, confidence scores rendered as UI elements
- [ ] Save scan history — persist captures + explanations to localStorage
- [ ] PWA support — installable on mobile as a native-feeling app
- [ ] Gemini audio input — speak your question without pressing a button

---

## 👥 Team

Built at [Hackathon Name] · [Date]

---

## 📄 License

MIT — free to use, modify, and build on.
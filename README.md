# Text-to-Audio with Voice Cloning

> Generate natural-sounding speech from any text using your own voice or built-in voice samples — powered by [Chatterbox TTS](https://github.com/resemble-ai/chatterbox).

---

## What It Does

Paste any text, choose a voice, and get a downloadable audio file — in seconds.

You can use **your own voice** (recorded live in the browser) or pick one of the **pre-recorded samples** included with the app. The AI clones the voice characteristics and speaks the text naturally, preserving tone, pace, and style.

---

## App Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Text-to-Audio App (Browser)                │
│                                                             │
│  ┌──────────────────┐   ┌──────────────────────────────┐   │
│  │   Choose a Voice │   │       Generate Speech        │   │
│  │                  │   │                              │   │
│  │  ○ Record Live   │   │  ╔══════════════════════╗   │   │
│  │  ○ Use Sample    │   │  ║ Type your text here  ║   │   │
│  │                  │   │  ║                      ║   │   │
│  │  ┌────────────┐  │   │  ║ "The quick brown fox ║   │   │
│  │  │ ● 0:08     │  │   │  ║  jumped over..."     ║   │   │
│  │  └────────────┘  │   │  ╚══════════════════════╝   │   │
│  │  [Submit Voice]  │   │                              │   │
│  │                  │   │  [▶ Generate Speech]         │   │
│  └──────────────────┘   │                              │   │
│                          │  ████████████░░░░  68%      │   │
│                          │  Chunk 3 of 4  •  4.2s      │   │
│                          │                              │   │
│                          │  ▶ ──────────●──── 0:12     │   │
│                          └──────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Analytics  ▼                                        │   │
│  │  Total: 18.3s  •  RTF: 1.5x  •  Throughput: 42 c/s │   │
│  │  [▇▇▇] Chunk 1  [▇▇▇▇▇] Chunk 2  [▇▇] Chunk 3     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

| Feature | Description |
|---|---|
| **Live voice recording** | Record directly from your microphone in the browser |
| **Pre-recorded voice samples** | Select a built-in Male or Female voice |
| **Long-form text support** | Automatically splits and stitches long texts |
| **Real-time progress** | Chunk-level progress bar with live timing |
| **Analytics dashboard** | RTF, throughput, per-chunk breakdowns, generation history |
| **Fully containerized** | One `docker compose up` runs everything |

---

## Architecture

The app is made of two services that run as Docker containers and talk to each other over HTTP.

```
┌──────────────────────────────────────────────────────────────┐
│                        Docker Compose                        │
│                                                              │
│   ┌─────────────────────┐      ┌──────────────────────────┐ │
│   │   Frontend (Nginx)  │      │   Backend (FastAPI)       │ │
│   │   Port: 80          │─────▶│   Port: 8000             │ │
│   │                     │      │                          │ │
│   │   React 19 + Vite   │      │   Python 3.11            │ │
│   │   TypeScript        │      │   Chatterbox TTS         │ │
│   │   ─────────────     │      │   FFmpeg / librosa       │ │
│   │   Static SPA        │      │   ──────────────         │ │
│   │   served by Nginx   │      │   REST API               │ │
│   └─────────────────────┘      └──────────┬───────────────┘ │
│                                            │                 │
│                                 ┌──────────▼───────────────┐ │
│                                 │   Persistent Volumes      │ │
│                                 │                          │ │
│                                 │   /data/voices           │ │
│                                 │   (registered voice WAVs)│ │
│                                 │                          │ │
│                                 │   model-cache            │ │
│                                 │   (PyTorch model weights)│ │
│                                 └──────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Backend API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/voice/register` | Upload a voice audio file |
| `POST` | `/api/tts/generate` | Start speech generation (async, returns 202) |
| `GET` | `/api/tts/status` | Poll generation progress |
| `GET` | `/api/tts/result` | Download the generated WAV |
| `GET` | `/api/tts/logs` | Full generation history |
| `GET` | `/api/tts/logs/latest` | Latest generation metrics |
| `GET` | `/api/health` | Health check |

---

## How It Works

### Step 1 — Choose a Voice

Two ways to provide a voice reference:

```
Option A: Record Your Voice                Option B: Use a Pre-recorded Sample
────────────────────────────────────       ────────────────────────────────────

  Browser Microphone                         Built-in Samples
       │                                          │
       │ WebM / Opus stream                       │ .wav file
       ▼                                          ▼
  MediaRecorder API                         fetch() from /pre-recorded-voices/
       │                                          │
       └───────────────────┬──────────────────────┘
                           │
                    POST /api/voice/register
                    (multipart/form-data)
                           │
                           ▼
                    Backend: voice.py
                    ┌────────────────────────────────────┐
                    │ 1. ffmpeg: convert → WAV 24kHz mono │
                    │ 2. ffprobe: measure duration         │
                    │ 3. Validate ≥ 10 seconds            │
                    │ 4. Save to /data/voices/{id}.wav    │
                    └──────────────┬─────────────────────┘
                                   │
                            ← 200 { voice_id }
                                   │
                            Frontend stores voice_id,
                            unlocks the TTS panel
```

### Step 2 — Generate Speech

```
User types text → clicks "Generate Speech"
       │
       ▼
POST /api/tts/generate { voice_id, text }
       │
       ▼
Backend splits text into chunks (~280 chars, at sentence boundaries)

  "The quick brown fox jumped    │   "over the lazy dog. It was a
   over the lazy dog."           │    beautiful morning."
        Chunk 1                  │         Chunk 2

       │
       ▼ (background thread)
For each chunk:
   ChatterboxTTS.generate(chunk, voice_reference)
       │
       ├── Produce audio tensor (24kHz)
       ├── Apply 50ms crossfade with previous chunk
       └── Log: duration, char count, RTF

       │
       ▼
Stitch all chunks → encode as WAV → store in memory
       │
       ▼
Frontend polls GET /api/tts/status every 1.5s
  { busy: true, chunk: 2, total_chunks: 4, total_elapsed_ms: 6100 }
       │
       ▼ (when busy: false)
GET /api/tts/result → download WAV blob → play in browser
GET /api/tts/logs/latest → populate analytics dashboard
```

### Text Chunking Strategy

Long texts are split intelligently to keep the TTS model from degrading on long inputs:

```
Input text
   │
   ├─ Split on sentence endings  (. ! ?)
   │
   ├─ If sentence > 280 chars → split on , ;
   │
   ├─ Group sentences until chunk ≥ 280 chars
   │
   └─ Merge tiny trailing chunks (< 20 chars) with previous

Result: natural, evenly-sized chunks that the model handles well
```

### Audio Stitching

```
Chunk 1 audio           Chunk 2 audio
────────────────▓▓▓▓    ▓▓▓▓────────────────
                 ↑          ↑
              50ms fade  50ms fade-in
              out

Result: ─────────────────────────────────────
         Seamless audio, no clicks or pops
```

---

## Analytics Dashboard

After each generation, an expandable panel shows detailed performance metrics:

```
┌─ Analytics ──────────────────────────────────────────────────┐
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Total    │ │Throughput│ │   RTF    │ │  Audio   │       │
│  │ 18.3s    │ │ 42 c/s   │ │  1.52×  │ │  12.1s   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  Chunk Timing Breakdown                                      │
│  Chunk 1 [██████████████░░░░░░░░]  4.1s  ●                 │
│  Chunk 2 [█████████████████░░░░░]  5.2s  ●                 │
│  Chunk 3 [████████░░░░░░░░░░░░░░]  2.8s  ●                 │
│  Chunk 4 [██████████░░░░░░░░░░░░]  3.1s  ●                 │
│           ← green (fast)      red (slow) →                  │
│                                                              │
│  # │ Text Preview         │ Chars │  Time  │ Audio │  c/s   │
│  1 │ "The quick brown..." │  142  │  4.1s  │  2.8s │  34    │
│  2 │ "over the lazy dog"  │  156  │  5.2s  │  3.3s │  30    │
│  3 │ "It was a beautiful" │   98  │  2.8s  │  1.9s │  35    │
│  4 │ "morning in the..."  │  112  │  3.1s  │  2.4s │  36    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**RTF (Real-Time Factor)** — the key performance metric:
- `RTF < 1.0` → generates audio *faster* than real-time (e.g. RTF=0.5 means 2× real-time speed)
- `RTF > 1.0` → generates audio *slower* than real-time (e.g. RTF=1.5 means 10s of audio takes 15s)
- RTF depends heavily on hardware; GPU reduces it significantly

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Run the App

```bash
git clone https://github.com/volcodes/text-to-audio-with-voice-cloning.git
cd text-to-audio-with-voice-cloning
docker compose up --build
```

> The first run downloads the TTS model weights (~1-2 GB). Subsequent starts use the cached model.

Open **http://localhost** in your browser.

> The backend runs on port `8000` and the frontend on port `80`. Both are accessible from the host.

### GPU Acceleration (optional)

To use a CUDA GPU, set the environment variable before starting:

```bash
DEVICE=cuda docker compose up --build
```

---

## Project Structure

```
text-to-audio-with-voice-cloning/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, lifespan
│   │   ├── routers/
│   │   │   ├── voice.py             # Voice registration endpoint
│   │   │   └── tts.py              # TTS generate/status/result/logs
│   │   └── services/
│   │       ├── tts_service.py       # Chatterbox TTS, chunking, stitching
│   │       └── audio_utils.py       # ffmpeg/ffprobe wrappers
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Root component, app state machine
│   │   ├── api/
│   │   │   └── client.ts            # All API calls
│   │   ├── components/
│   │   │   ├── RecordingPanel.tsx   # Live microphone recording
│   │   │   ├── PreRecordedVoicePanel.tsx  # Voice sample selector
│   │   │   ├── TTSPanel.tsx         # Text input + generation UI
│   │   │   ├── AnalyticsDashboard.tsx     # Metrics and charts
│   │   │   ├── AudioPlayer.tsx      # HTML5 audio player
│   │   │   └── TextDisplay.tsx      # Header / instructions
│   │   ├── hooks/
│   │   │   ├── useVoiceClone.ts     # Voice registration + TTS state
│   │   │   └── useAudioRecorder.ts  # MediaRecorder wrapper
│   │   └── types/
│   │       └── analytics.ts         # TypeScript interfaces
│   ├── pre-recorded-voices/
│   │   ├── Female Sample.wav
│   │   └── Male Sample.wav
│   ├── nginx.conf
│   └── Dockerfile
└── docker-compose.yml
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| TTS Engine | [Chatterbox TTS](https://github.com/resemble-ai/chatterbox) |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Audio processing | FFmpeg, librosa, soundfile, PyTorch |
| Frontend | React 19, TypeScript, Vite |
| Serving | Nginx (frontend), Uvicorn (backend) |
| Containers | Docker, Docker Compose |

---

## License

MIT

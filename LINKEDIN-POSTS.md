# LinkedIn Posts — FitTrack AI Launch

---

## POST 0 (FINAL — Open Source + Smart Positioning)

I built an AI fitness tracker that watches you exercise.

No wearable. No gym equipment. Just your camera.

It's open source and free to use right now:
https://fitness.aiwithdhruv.com

Here's what it does:

Point your camera -> AI tracks 33 body joints -> counts your reps automatically.
Push-ups, squats, sit-ups. Real-time. In your browser.

Take a photo of your food -> AI breaks down calories, protein, carbs, fat.
Tells you what to eat more of and what to avoid.

What I'm most proud of — the architecture:

- All pose detection runs client-side (MediaPipe + WebAssembly + GPU)
- Zero data leaves your device
- No backend server. No cloud. Runs entirely in your browser.
- Install it as an app on your phone (PWA)
- Works offline after first load

Under the hood:
- 3-frame angle smoothing for accurate rep counting
- Threshold state machine: DOWN -> UP = 1 rep
- XP system with streak multipliers and 12 unlockable badges
- GitHub-style activity heatmap to track consistency

I built this to prove a point:

The best AI products don't always need a server farm.
Sometimes a browser, a camera, and good engineering is enough.

Right now it's completely free. I want real people using it, breaking it, telling me what's missing.

The source code is open — fork it, learn from it, build on top of it.

GitHub: https://github.com/aiagentwithdhruv/fittrack-ai

Go try it. Do 10 push-ups. Tell me if it counts right.

#AI #OpenSource #BuildInPublic #MediaPipe #FitnessAI #EdgeAI

---

## POST 1 (Technical Builder)

I built an AI fitness tracker that runs entirely in your browser.

No backend. No subscription. No wearables.

Just open the camera and start doing push-ups.

Here's how it works:

The system has 3 AI pipelines running client-side:

1. Pose Detection
   - MediaPipe Landmarker tracks 33 body joints at 30fps
   - A state machine calculates joint angles in real-time
   - DOWN to UP transition = 1 rep (with cooldown + smoothing)

2. Food Analysis
   - Take a photo of your meal
   - Grok 4.1 via OpenRouter analyzes it
   - Returns: calories, protein, carbs, fat + eat/avoid recommendations
   - Cost: ~$0.001 per analysis

3. Gamification Engine
   - XP system with streak multipliers
   - 12 unlockable badges
   - GitHub-style activity heatmap

The architecture decision was deliberate:

- All AI inference happens in the browser (WebAssembly + GPU)
- Zero data leaves your device (IndexedDB for storage)
- PWA installable — works offline
- Total hosting cost: $0/month

Tech: React + TypeScript + MediaPipe + Dexie.js + Vite
Deployed: Vercel + Cloudflare

Try it yourself (takes 10 seconds):
https://fitness.aiwithdhruv.com

Source code:
https://github.com/aiagentwithdhruv/fittrack-ai

The best AI products don't need a server farm.
Sometimes all you need is a browser and a good architecture.

#AI #MediaPipe #WebDev #FitnessAI #OpenSource #BuildInPublic

---

## POST 2 (Product Thinking — SHORT & PUNCHY)

Most fitness apps need:
- A $50M backend
- Your health data on their servers
- A monthly subscription

I built one that needs:
- A browser
- Your camera
- Nothing else

FitTrack AI counts your reps using pose detection AI.
Scans your food with one photo.
Tracks everything locally on your device.

Zero servers. Zero cost. Zero data collection.

The entire AI pipeline runs in your browser using WebAssembly.

Architecture:
Camera -> MediaPipe (33 landmarks) -> Angle calc -> State machine -> Rep count

That's it. No cloud. No API calls for the core feature.

Built in a weekend. Open source.

Try it: https://fitness.aiwithdhruv.com
Code: https://github.com/aiagentwithdhruv/fittrack-ai

What would you build if you stopped assuming AI needs a server?

#AI #BuildInPublic #FitnessAI #EdgeAI #OpenSource

---

## POST 3 (System Design Deep Dive)

I spent the weekend solving an interesting system design problem:

How do you count exercise reps with AI — with zero latency and zero backend?

The answer: a 3-layer client-side pipeline.

Layer 1: Perception
MediaPipe Pose Landmarker runs on WebAssembly + GPU
33 body landmarks extracted per frame at 30fps
All inference happens in-browser — no server round-trip

Layer 2: Intelligence
Raw landmarks -> joint angle calculation (shoulder-elbow-wrist)
3-frame moving average for noise smoothing
Threshold-based state machine: IDLE -> DOWN -> UP
DOWN-to-UP transition + 350ms cooldown = 1 verified rep

Layer 3: Engagement
XP = 100 (base) + 2/rep + 20 (bonus) x streak multiplier
12 badges with compound unlock conditions
Activity heatmap (12-week rolling window)

The food scanner is the only part that calls an API:
Photo -> Base64 -> OpenRouter -> Grok 4.1 -> JSON (calories, macros, tips)
Cost: ~$0.20 per million tokens

Everything else: IndexedDB, localStorage, service worker.
Fully offline after first load.

Result: A PWA fitness tracker that
- Counts push-ups, squats, sit-ups automatically
- Analyzes food photos with AI
- Costs $0/month to run
- Keeps all data on your device

Try it: https://fitness.aiwithdhruv.com
Architecture + code: https://github.com/aiagentwithdhruv/fittrack-ai

The edge is the new cloud.

#SystemDesign #AI #EdgeComputing #MediaPipe #BuildInPublic #OpenSource

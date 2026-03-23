---
name: fittrack-ai
version: 1.0.0
description: AI-powered fitness tracker — camera rep counting, food scanner, gamification, PWA
author: AiwithDhruv
license: MIT
tier: free
last_verified: 2026-03-07
refresh_cadence: monthly
dependencies: []
platforms: [claude-code]
---

# FitTrack AI — Agent Loadout

> AI fitness tracker that counts exercise reps using camera (MediaPipe) and analyzes food photos for nutrition. PWA — works offline on any device.

---

## What's Included

| Component | Description |
|-----------|-------------|
| Rep Counter | Camera tracks body joints via MediaPipe AI — push-ups, squats, sit-ups |
| Food Scanner | Photo -> AI analyzes calories, protein, carbs, fat + recommendations |
| Gamification | XP system, 12 badges, streaks, levels |
| Activity Heatmap | 12-week GitHub-style contribution grid |
| Export | CSV export for workouts and nutrition logs |
| PWA | Installable, works offline |

## Tech Stack

- React + TypeScript
- MediaPipe Pose Landmarker (client-side)
- IndexedDB via Dexie.js (local storage)
- Vite build
- Vercel deployment

## Live

- URL: https://fitness.aiwithdhruv.com
- GitHub: aiagentwithdhruv/fittrack-ai

## Key Files

| File | Purpose |
|------|---------|
| `src/` | React components + hooks |
| `public/` | PWA manifest + assets |
| `screenshots/` | App Store-ready screenshots |
| `README.md` | Full documentation |

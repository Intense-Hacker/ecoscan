# EcoScan – AI Plant Health & Pollution Detector
**Group No. 2** | Sabareesh, Tanuj, Taba Sonu, Sahil, Manas, Nachiket

---

## Setup (100% Free — No credit card needed)

### Step 1 — Get your FREE Gemini API key
1. Go to https://aistudio.google.com/apikey
2. Sign in with any Google account
3. Click "Create API Key" → copy it

### Step 2 — Add API key to the project
Rename `.env.example` to `.env`, then open it and paste your key:
```
VITE_GEMINI_API_KEY=AIza...your_key_here
```

### Step 3 — Install & Run
```bash
npm install
npm run dev
```
Open http://localhost:5173

---

## Features
- **Dashboard** – Area health score, stats, recent scans
- **Leaf Scanner** – Upload plant photo → Gemini AI detects stress, causes, fix-it tips
- **Eco Map** – Leaflet.js map of scan locations
- **Reports** – Full scan history, filterable by stress level

## Tech Stack
- React 18 + Vite
- Tailwind CSS
- React Router v6
- Leaflet.js
- **Google Gemini 1.5 Flash API** (free, no credit card)
- localStorage for data persistence

## Free API Limits (Gemini)
- 15 requests/minute
- 1 million tokens/day
- Completely free, no billing required

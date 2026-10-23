# TripMind AI

A responsive AI travel planner application built with React, Vite, Express, and Google Gemini GenAI.

## ✨ Features

- **Responsive editorial landing page** with curated destination inspiration (Kyoto, Bali, Lisbon, Amalfi Coast, Oaxaca, Reykjavík).
- **Interactive trip builder**: customize destination, start date (with automatic calendar date calculation for every day), duration, budget tier, traveler count, and personal travel interests.
- **AI-Powered Itinerary Generation**: backed by Google Gemini models (`gemini-3-flash-preview` / `gemini-3.5-flash`) with automatic multi-model failover and smart JSON sanitization.
- **Estimated Budget Breakdown**: visual expense distribution for accommodation, dining, activities, and local transit.
- **Insider Travel Tips & Best Seasons**: practical local guidance and ideal times to visit.
- **Category Filter Bar**: dynamically filter activities by Food & Cafés, Culture & Heritage, Nature & Walks, or view all.
- **Interactive Activity Checklist**: check off places and sights as you explore.
- **Persistent Saved Plans**: save itineraries directly to `localStorage`, view saved trips anytime in the Saved Plans drawer, load them, or delete them.
- **Export & Print Ready**: print-friendly media styles for generating PDFs or physical itineraries, plus one-click copy to clipboard.
- **Smart Offline Concierge Fallback**: works seamlessly even if offline or if API limits are reached.

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Environment Variables

Check `.env` in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
```

*(TripMind AI supports both `GEMINI_API_KEY` and `OPENAI_API_KEY` environment variables seamlessly).*

### 3. Run the App

In **Terminal 1** (Backend API Server):
```bash
npm run server
```
Runs at `http://localhost:3001`.

In **Terminal 2** (Frontend Dev Server):
```bash
npm run dev
```
Runs at `http://localhost:5173`.

---

## 📦 Production Build

```bash
npm run build
npm start
```
The Express server on `http://localhost:3001` serves both the API endpoints and the static production build from `dist/`.

---

## 🛠️ Project Architecture

```text
tripmind-ai/
├── index.html
├── package.json
├── vite.config.js       # Vite config with /api reverse proxy
├── .env                 # API keys & port configuration
├── src/
│   ├── main.jsx         # React frontend application
│   └── styles.css       # Complete design system & print styles
└── server/
    └── index.js         # Express server with Gemini GenAI fallback engine
```

# FarmSphere AI

An AI-powered farm digital twin: simulate rainfall, fertilizer and irrigation
changes, predict yield/profit/climate risk, get an AI farming assistant
(English & Tamil), AI crop-disease detection from a photo, and a Green Farm
sustainability score.

This is a from-scratch recreation of the supplied reference project, rebuilt
to the requested stack — **React + Vite + TypeScript + Tailwind CSS +
Framer Motion + Recharts** on the frontend, **Flask + REST API** on the
backend, **PostgreSQL-ready / SQLite-for-dev** on the database — with the
same pages, layout, components, charts, workflows, theme and interactions
as the source, renamed to FarmSphere AI.

## Project structure

```
farmsphere-ai/
├── frontend/     React + Vite + TypeScript + Tailwind + Framer Motion + Recharts
└── backend/      Flask REST API + SQLAlchemy models + JWT auth
```

## Quick start

### 1. Backend (Flask)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python run.py                     # runs on http://localhost:5000
```

Uses SQLite (`farmsphere.db`) by default — zero setup required. To use
PostgreSQL instead, set `DATABASE_URL` in `.env` to your Postgres connection
string, e.g. `postgresql://user:password@localhost:5432/farmsphere`.

### 2. Frontend (Vite)

```bash
cd frontend
npm install
npm run dev                       # runs on http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:5000`, so open
`http://localhost:5173` and both halves work together immediately.

## What was ported 1:1

- **Theme, layout, colours, glassmorphism, typography, spacing, charts** —
  copied byte-for-byte from `src/styles.css` and every page/component; no
  redesign, no layout changes.
- **The AI/simulation engine** (`lib/agri.ts` → also ported to
  `backend/app/agri.py`) — crop profiles, yield/profit/risk/sustainability
  formulas, deterministic weather model — copied exactly so results match
  the reference app to the decimal.
- **Every original page**: Landing, Auth, Dashboard, Digital Twin, What-If
  Simulation, AI Assistant, Crop Health, Climate Risk, Profit Prediction,
  Sustainability (Green Score), Profile.
- **The database schema** (`profiles` / `farms` / `farm_zones` +
  auto-provisioning of a starter farm and 4 crop zones on signup) —
  ported from the Postgres migration/trigger to SQLAlchemy models and a
  `provision_new_farmer()` helper called at registration time.

## Advanced intelligence modules (upgrade pass)

Four additional modules were added on top of the original feature set,
using the same deterministic client-side engine philosophy as the rest of
the app (crop/weather/farm-data in → structured prediction out), plus two
new database tables (`disease_scans`, `voice_consultations`) for history:

1. **Advanced Disease Intelligence** (`lib/disease-intel.ts`) — upgrades
   Crop Health with severity analysis (severity %, infection level, risk
   level), disease progression prediction (day 0/3/7/14 forecast + trend
   chart), affected-area heatmap overlay on the uploaded photo, a Disease
   Intelligence Dashboard (total scans, active/critical cases, most common
   disease, weekly trend), and a simulated Nearby Outbreak Alert feed.
2. **AI Pest Outbreak Prediction Engine** (`lib/pest-engine.ts`) — predicts
   pest risk from crop, weather and growth stage across 7 tracked pests,
   with a risk dashboard, seasonal risk analysis, a per-zone pest risk
   heatmap driven by real zone telemetry, and organic/chemical/monitoring/
   emergency prevention guidance.
3. **Smart Farm Drone Intelligence Dashboard** (`lib/drone.ts`) — simulated
   aerial-scan analytics: farm overview, an interactive crop-stress
   heatmap, per-zone scan reports, vegetation analytics, and AI-generated
   natural-language insights. No drone hardware integration — intelligent
   simulation only, as specified.
4. **Tamil Voice Farm Doctor** (`pages/VoiceDoctor.tsx`) — real speech-to-
   text via the browser's Web Speech API (Tamil/English), a structured AI
   diagnosis (cause, probability, disease, action, prevention), a spoken
   voice reply, and consultation history.

The Dashboard was also extended with 5 summary widgets tying all of the
above together: Active Disease Alerts, Pest Risk Summary, Drone Scan
Summary, Voice Consultations Today, and a computed Farm Health Index.

## Necessary technical adaptations (and why)

The reference app was built on **Lovable's proprietary cloud platform**
(TanStack Start server routes, Supabase-managed Postgres/Auth, and Lovable's
hosted AI gateway at `ai.gateway.lovable.dev`). Per your instructions to
remove Lovable traces while keeping the product fully functional, and to
target a Flask/React stack, three things had to be re-implemented rather
than copied verbatim — visual/behavioral parity was kept as close as
technically possible in each case:

1. **Auth & data layer** — Supabase's client SDK/RLS was replaced with a
   plain JWT REST API (`/api/auth/register`, `/login`, `/me`,
   `/farm-data`, `/profile`, `/farm`) backed by SQLAlchemy. Same fields,
   same auto-provisioning behaviour, same UI.
2. **"Continue with Google" button removed from the login page.** It
   depended on Lovable's hosted OAuth proxy (`@lovable.dev/cloud-auth-js`),
   which only works inside Lovable's own infrastructure and has no
   self-hostable equivalent. Email/password auth (the app's other login
   path) is fully implemented and unchanged.
3. **AI Assistant, Crop Health (disease detection), Voice Farm Doctor &
   Text-to-Speech** — the reference app proxied all four to Lovable's
   private AI gateway using a `LOVABLE_API_KEY` that only works inside
   Lovable's platform. FarmSphere AI ships:
   - A **deterministic, rule-based fallback engine** for all four (keyword-
     matched farming advice in English/Tamil; seeded pseudo-diagnosis for
     crop photos and voice queries) — so the product works fully, offline,
     with zero configuration, exactly like the rest of the app's
     deterministic "AI" (see `getWeather()`).
   - An **optional real-LLM upgrade path**: set `OPENAI_API_KEY` in
     `backend/.env` and all four endpoints automatically switch to calling
     OpenAI's chat/vision/TTS APIs instead — no frontend changes needed.
     Without a key, `/api/tts` returns a clean "not configured" response,
     which the frontend already treats as a signal to use the browser's
     built-in `speechSynthesis` for voice playback — that fallback was
     already built into the reference app, not added for this port.

Everything else — every page, card, chart, workflow, route, form, and the
visual theme — is unchanged.

## Tech stack

**Frontend:** React 18, Vite, TypeScript, Tailwind CSS v4, Framer Motion,
Recharts, React Router, TanStack Query, shadcn/ui, Zod.

**Backend:** Flask, Flask-SQLAlchemy, Flask-JWT-Extended, Flask-CORS.

**Database:** SQLite (dev) / PostgreSQL (production-ready via
`DATABASE_URL`).

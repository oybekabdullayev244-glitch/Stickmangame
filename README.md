# Stick Arena Party (Web)

Deploy-ready Next.js game project with an original stick-figure survival loop, in-game currency economy, and optional rewarded-bonus flow.

## Current MVP

- Original arena survival gameplay in `src/components/game/stick-party-game.tsx`
- Routes: `/`, `/play`, `/about`, `/updates`, `/privacy`, `/terms`
- Persistent local profile with credits, crystals, score history, and event log
- Reward model:
  - Match rewards after every run
  - Optional rewarded bonus at Game Over only
  - Reward granted only on completion
  - Cooldown + daily cap for anti-abuse basics
  - Reward odds shown before rewarded attempt
- Deploy readiness:
  - `public/ads.txt`
  - `src/app/robots.ts`
  - `src/app/sitemap.ts`
  - `public/privacy.html` + `public/terms.html`
  - `.env.example`

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build check

```bash
npm run lint
npm run build
```

## Environment variables

Copy `.env.example` to `.env.local` and fill values when available.

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- Firebase keys (`NEXT_PUBLIC_FIREBASE_*`)
- Ad Manager placeholders (`NEXT_PUBLIC_AD_MANAGER_*`)

## Monetization status

Rewarded flow is implemented as a safe local simulation layer for now. Ad Manager rewarded GPT events can be wired into the same completion-only logic next, without changing the economy rules.

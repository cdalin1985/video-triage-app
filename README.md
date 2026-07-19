# Video Triage

Drop a short-form video (reel, TikTok, Short). The app reads it, verifies its
claims against the open web, and hands you a skeptical verdict — and it builds
an action plan only after you explicitly approve.

The pipeline **is** the UI: `INTAKE → EXTRACT+VALIDATE → BRIEF → GATE → ACT`,
rendered as a live stepper. The gate is structural, not a prompt: the API has
two phases, and phase two (`/api/act`) only fires when you click
**APPROVE — BUILD IT**, and refuses dossiers that didn't clear their playbook's
confidence bar.

## Tiered architecture (cheap reads, premium judges)

| Stage | Who | Cost |
|---|---|---|
| Read frames + caption, classify, write search queries | Gemini Flash (free AI Studio tier) — falls back to Claude Haiku | free / pennies |
| Verify claims | Tavily (1k/mo free) or Brave (2k/mo free) | free |
| Validate, score confidence, write the brief | Claude Sonnet — compact text dossier only, no images | ~1–3¢ |
| ACT build (post-approval only) | Claude Sonnet | rare by design |

Frames are extracted **in your browser** via canvas — the video file never
touches the server, and nothing server-side ever fetches from the platform the
video came from.

## Playbooks

Five category playbooks live in [`src/prompts.ts`](src/prompts.ts):

- **side_hustle** — the ≥90% legitimacy rule: below 90, the build button never
  renders and the confidence badge shows red. Enforced in server code, not just
  in the prompt.
- **automation_tool** — non-affiliate reviews and primary docs only.
- **repo_or_tool** — fit-checked against `STACK_PROFILE` (edit it in
  `src/prompts.ts` to match your machine).
- **product** / **content_technique** — plus a product addendum that triggers on
  any category whenever something is being sold.

Degradation is honest: no search key → the app runs, tells you flat-out the
claims are unverified, and caps side-hustle confidence. No Gemini key → Haiku
reads the frames instead.

## Setup

```bash
npm install
cp .env.example .env   # fill in keys
npm run dev            # UI on :5173
vercel dev             # API on :3000 (the Vite proxy points at it)
```

Keys (see `.env.example`):

- `ANTHROPIC_API_KEY` — required (judgment tier)
- `GEMINI_API_KEY` — free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- `TAVILY_API_KEY` — free at [tavily.com](https://tavily.com) (or `BRAVE_API_KEY`)

## Deploy

Push to GitHub, import into Vercel, set the three env vars in
**Settings → Environment Variables**, deploy. That's it — static Vite build
plus two serverless functions.

## Known limitations

- Frames only, no audio: a pure talking-head video with no on-screen text needs
  its caption pasted into the caption box.
- Free-tier search snippets run shallower than paid search; thin evidence just
  means a verdict won't clear the bar and won't build.

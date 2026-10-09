# Build status · October 9, 2026

The repo was empty when the build started (no commits, no remote branches), so there was no prior work to preserve. Everything below was built and tested in this session.

## What works

**Chief Emeka's full 7-day run, end to end, in a phone viewport.** Verified by `npm run shots`, which plays a complete run against the production build: age gate, setup, roster, match, seven days of cards, a city spot, voice notes, an incoming call, the ending scene, Verdict Card, Receipts and the Advertise page. Result: zero page errors.

- **Setup in under 45 seconds:** 18+ gate (No leads to the Teen edition screen), identity with a display-name filter, a 3-tap avatar scored against hidden Taste, who you date, 5 vibes, 4 secret goals.
- **Roster:** Tinder-style swipe for all 10 characters. The launch gate (rule 17) locks the 9 without decks as "Dropping soon".
- **Run engine:** all 23 engine rules (see the table in README.md), seeded and replayable. A saved run is just its seed plus choices and restores by replay.
- **Chief's deck:** 30 cards, against a minimum of 17: 3 First Dates, 3 Red Flags, 3 Money Traps, 3 Public Drama, 3 Confrontations (one per truth), 6 payoffs, 3 control escalations, 6 Talking Time. Every card carries a tell for each truth it can appear under.
- **Shared deck:** 6 Temptations, 6 Public Drama/crossovers (Mercy, Blessing and Kayode cameos), 8 interrupts (NEPA, Third Mainland traffic, Lekki-Epe flood, okada, work call, Bestie, Parlour leak, Mama Nonso), and 11 shared payoffs (loan collectors, botched clinic, the 2-day club storyline, Timi blog, Nonso, location lie, scandal brewing, seen out).
- **City spots on the phone:** Clinic (with budget, mid and luxury tiers), Bestie (genius or toxic; toxic intel is wrong), Amebo (can sell your secret to the partner), Therapist/Deliverance (naming the tactic unlocks call-outs), Club (starts a 2-day storyline; Chief gets possessive).
- **Living scenes:** all 8 launch locations as layered, animated backdrops (danfos and okadas, Link Bridge cables and light streaks, rain on glass, sparklers and lasers, ring lights, ceiling fan, suya smoke, candles), time-of-day lighting, and NEPA blackout, rain and siren effects. Lite mode switches on automatically for low-end devices and slow connections.
- **Characters:** illustrated SVG portraits with 6 expressions, blinking, breathing, enter animation and a phone that lights up in hand. NPCs get stable looks. Real `.webp` art swaps in automatically when present.
- **Sound:** WebAudio soundscapes for every location (club bass through the walls, traffic horns, generator hum, rain, salon chatter, clinic pads, conductors shouting via speech synthesis), plus UI sounds (cash, ping, sting, heartbeat, ring), ducking under dialogue and a mute toggle. Any `.mp3` in `public/audio/` replaces a layer.
- **In-game phone:** slide-in notifications (bank alerts on every money change, texts, Parlour gist), and full-screen takeovers for texts, voice notes (waveform, play) and incoming calls (answer/decline).
- **Feedback:** animated meters, floating deltas, pulse on big hits, screen shake and red vignette on big Sanity hits, "+N Chemistry" toasts, dice badges.
- **Verdict Card and Receipts:** designed 9:16 card (exported at 1080×1920), 1200×675 card for X, POS-slip Receipts image, plus WhatsApp, X, IG Story (Web Share), copy link, QR code, trophy shelf, challenge comparison and Phase 2 WhatsApp capture. All 10 endings render inside the frame (`scripts/card-gallery.ts`).
- **Share landing** at `/v/<payload>` with "Date Chief yourself" and "Beat their score".
- **Brand slots:** billboard, street poster, club "Now playing", date venue, glow spots, gifts, bank app, Parlour post and Verdict strip are all inside scenes. They show only in positive or neutral scenes, have per-run caps, and run house ads that link to `/advertise` (rate card) when empty.
- **PWA:** manifest, icons, service worker (offline shell); initial JS is 136 KB gzipped, with the share code loaded lazily.

## Test results (real runs)

- `npm test`: **59/59 passing.** Includes:
  - determinism (same seed and choices give an identical state, and replaying the history equals the original run)
  - the truth roll lands at 25% Good One across 4,000 seeds
  - **scripted seeded runs reaching all 10 endings** (Locked In, Counter-Con, Survived, Scandal, Sapa, Breakdown, Ghosted, Fumbled, Obsession, Walked Away), each replayed to prove it reproduces
  - every hidden truth's confrontation and tells
  - every payoff card drawn
  - the Rolex → recognised → woman-messages chain
  - Talking Time unlocks and the 2-day club storyline
  - knowledge rules (world ≠ partner)
  - cautious choices never cost Trust; toxic choices on a Good One drain it
  - Obsession only when the player chose to stay
  - escalation exits
  - loan → collectors, ₦0 always has a free choice, a single bail-out
  - receipt provenance, share-payload round-trip, and every NPC and avatar combo rendering
- `npm run validate`: Chief and the shared deck pass. Every ending and every Chief card was reached in 3,600 simulated runs.
- `npm run simulate`, 1,000 random runs per vibe (payments off, no bail-outs):

| Vibe | Reach Day 7 | Locked In | Survived | Ghosted | Fumbled | Obsession | Walked Away |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lover | 80.5% | 3.5% | 75.4% | 2.5% | 6.2% | 0.6% | 3.5% |
| Sugar | 66.9% | 0.7% | 64.2% | 9.9% | 10.5% | 0.1% | 5.5% |
| Big Boy | 63.3% | 0.0% | 62.1% | 13.4% | 11.3% | 0.2% | 2.1% |
| Runs | 60.1% | 0.2% | 57.5% | 17.1% | 13.0% | 0.7% | 4.3% |
| Corporate | 84.1% | 5.1% | 77.2% | 2.4% | 6.4% | 0.5% | 1.6% |

  These are random-tapping players: they measure balance, not coverage. With deliberate play (the lookahead player), Locked In is reachable on every vibe: Lover 38/40 seeds, Corporate 34/40, Sugar 11/40, Big Boy 11/40, Runs 9/40.

## What failed during the build (all fixed)

- **Black-screen crash mid-run:** NPC portrait colours used a signed bit shift on an unsigned hash, so some names produced `undefined` colours. Fixed; a test now covers every NPC name and every avatar combination. An error boundary now catches any render crash and offers a reload, since the run is saved.
- **Partner reacting before knowing:** a "discovery" card applied its news on choose rather than on draw. Caught by the knowledge test and fixed.
- **Verdict Card overflow:** the footer and QR code were clipped. The layout was tightened and the gallery script now checks the fit for all endings.
- **Duplicate notification IDs** within one millisecond. Fixed.
- **Engine entry animation** overrode the portrait's centring transform. Fixed.

## Unfinished (honest list)

1. **The other 9 characters' decks** (build step 8). Their public cards, truths, tells, Taste, Temperament and behaviour rules are in `characters.json`, but they stay locked by the launch gate until their decks pass validation.
2. **Backend is not live.** The schema, RLS and Paystack verification function are written (`supabase/`) but not deployed. The game runs on `LocalBackend`:
   - payments are off; the Bail-Out and Clue Pass screens explain why
   - there are no live counters
   - rivalry alerts, auto-gossip from real runs, Hall of Fame/Shame and Squad Runs are not built
   - invite-earned free Bail-Outs are not built
   - a server-side `finish-run` replay to verify endings is still to write
3. **Per-card Open Graph images (rule 12).** Share links work and show the card, but the link preview uses one static OG image. Dynamic images need a serverless renderer plus storage, and nothing has been tested inside WhatsApp or X yet.
4. **Real art and audio.** Portraits and locations are code-drawn placeholders, and sound is synthesized. The `public/art` and `public/audio` drop-in pipeline is ready.
5. **Advertise platform (step 14).** Only the rate card and slot list exist. Self-serve booking, Paystack checkout, the approval queue, brand dashboard and admin panel are not built.
6. **Analytics.** Events (`setup_completed`, `character_picked`, `day_reached`, `run_ended` and so on) are buffered in localStorage only. There is no PostHog or Supabase sink yet.
7. **Real-device testing.** Everything was tested in headless Chromium at phone size, not on a cheap Android phone over 3G.
8. **Smaller gaps:**
   - the phone's Messages history is not persisted across reloads
   - declining a call re-rings rather than branching (the consequences sit in the call card's choices)
   - characters animate in but not out
   - skin tone comes from the display name rather than being a fourth avatar tap
9. **Content is a first draft for the creator to edit,** as the brief intends.

# Wahala: The Dating Survival Sim · Season 1: Lagos

Date a pre-built Lagos character for 7 in-game days, survive the wahala, and walk away with a Verdict Card you can't help posting. 18+. Mobile-first PWA, no install, no sign-up.

This repo holds the **Chief Emeka vertical slice**: the full 7-day run, built on an engine that already handles all 10 characters, with 9 of them locked by the launch gate until their decks are written.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 59 engine, coverage and UI-helper tests
npm run validate     # content validation + launch gate (also runs before every build)
npm run simulate     # 1,000 random runs per vibe: Day-7 rates and ending spread
npm run build        # validate, then production build to dist/
npm run shots        # after build: plays a full Chief run in a phone viewport, screenshots every stage
npx tsx scripts/card-gallery.ts   # after build: renders every ending's Verdict Card via its share link
```

Deploy to Vercel (`vercel.json` has SPA rewrites and caching headers): set `VERCEL_TOKEN` in the environment, then `npm run deploy:preview`. `npm run build:preview` builds a hash-routed copy (`dist-preview/`) that runs inside sandboxed frames such as a claude.ai preview.

## How it fits together

| Path | What it is |
| --- | --- |
| `src/engine/` | Pure, deterministic TypeScript game engine. No React, no DOM. Runs in the browser, in Node tests, and can run in a Deno Edge Function for server-side replay. |
| `src/engine/engine.ts` | Run creation (truth roll, Spark, Taste, Bestie, deck shuffle), drawing, choices, rules, spots, endings, bail-out, Clue Pass, replay. |
| `src/engine/verdict.ts` | Verdict Card data and Wahala Receipts, built only from logged events. |
| `src/engine/validate.ts` | Content rules (matrix, flags paid off, knowledge, probabilities, budgets, exits, avatar coverage, real-names policy). |
| `src/engine/sim.ts` | Bot players (random plus 5 strategy policies) for simulation. |
| `data/` | All content. Edit these without touching code. |
| `src/ui/` | React UI: setup, roster, run screen, phone, scenes, portraits, sound, Verdict, share, advertise. |
| `src/backend/` | Backend adapter. Ships as `LocalBackend` (payments off, no fake counters). |
| `supabase/` | Schema, RLS and the Paystack verification function, ready to deploy. |
| `tests/` | Vitest suites. `scripted.test.ts` reaches every ending on fixed seeds and replays them. |

### Content files (drop-in, no code changes)

- `data/cities/lagos/characters.json`: public card, truths and tells, Taste, Temperament, behaviour rules, expressions, endings text, portrait look.
- `data/cities/lagos/cards/*.json`: every file here is loaded automatically. `chief_emeka.json` is the full deck; `shared.json` is the city deck.
- `data/cities/lagos/locations.json`: each location's palette, ambient layers, soundscape, brand slots and transition. Scenes are data.
- `data/cities/lagos/spots.json`, `city.json` (vibes, goals, avatar options, in-world gossip), `brands.json` (slots, rates, bookings).
- `data/titles.json`, `data/lessons.json`, `data/roasts.json`.
- Generated: `data/launch-gate.json` (by `validate`), `data/rarity.json` (by `npm run rarity`).

**Adding a character:** add them to `characters.json`, write `cards/<id>.json` to the content matrix, run `npm run validate`. The launch gate unlocks them on the roster once they pass. **Adding a location:** add an entry to `locations.json` that reuses existing layer types (or add a layer renderer in `src/ui/scene/Scene.tsx`). **Adding art:** drop `public/art/<character>_<expression>.webp` (for example `chief_charming.webp`) or `public/art/<location>.webp`; it replaces the illustrated placeholder automatically. **Adding sound:** drop `public/audio/<layer>.mp3` to replace a synthesized layer.

### Card format (extends the brief's sample)

Cards add `scene` (location, time, expression, mood, fx, npc), `beats` (typed dialogue), per-truth `tells`, `requires` conditions, `sets`/`discovers` for story memory and knowledge, and `presentation` (`scene`, `text`, `voice_note`, `call`). Choices carry `tags` (`toxic`, `cautious`, `investigate`, `luxury`, `budget`, `stay`, `exit`...), `cost`, vibe-only options and `truth_override`. Outcomes carry meter deltas, `bond`, `goal`, `set`/`reveal` with knowers, `saw_truth`, `truth_exposed`, `bad` (worse dice branch), `tricked`, `receipt` and `end`.

## Engine rules v2: where each one lives

| # | Rule | Implementation | Proof |
| --- | --- | --- | --- |
| 1 | Story memory | Flags with day and knowers; `requires`/`payoff_of`; 6 Chief payoff cards + 11 shared | validator fails unpaid flags; Rolex → recognised → woman messages test |
| 2 | Attachment + Trust, Temperament | Two hidden meters; controlling partners gain Control as Attachment rises | engine |
| 3 | Characters remember | `rules` per character applied on tags and spot visits (Chief has 5) | validator requires ≥3 |
| 4 | Truth roll | 25% Good One, rest split evenly; Spark separate 1/6 | 4,000-seed distribution test |
| 5 | Phase 1 endings | Locked In replaces The Altar | — |
| 6 | Content matrix + validation | `validate.ts`, runs before every build | `npm run validate` |
| 7 | Economy | Tier-scaled costs, greyed options with reasons, Loan App with separate Debt and collectors payoff, salary | 1,000 runs/vibe simulation |
| 8 | Spots are decisions | Bestie intel can be wrong (toxic Bestie), Club 2-day storyline, Therapist names a tactic that unlocks call-outs | club storyline test |
| 9 | Wahala Receipts | 4–5 most consequential logged events + title + roast; own image | receipt provenance test |
| 10 | Server trust | Bail-Out/Clue only on server-verified grants; payments off until then | `LocalBackend`, `supabase/` |
| 11 | Parlour honesty | No fake counters; gossip labelled in-world; preset reactions; report/block; name filter | UI |
| 12 | Share links | `/v/<payload>` landing with card and CTAs; static OG image | partial, see below |
| 13 | Who knows what | `player`/`partner`/`world`/`wife`/`bestie`/`amebo` knowers; `partner_reacts_to` validated | knowledge tests |
| 14 | Good Ones | Toxic drains Trust and pays no Clout; cautious never costs Trust; Fumbled It | tests |
| 15 | Receipts tell the truth | Lines only from logged events; dice and "played" causes recorded | tests |
| 16 | Obsession + budget tiers | No-roast card; validator requires a budget option beside every luxury one | tests |
| 17 | Launch gate | `launch-gate.json`; roster locks failing characters | validate + tests |
| 18 | Knowledge propagation | `discovers` delivers facts on draw; world ≠ partner | tests |
| 19 | Context decides | `investigate` resolves to cautious/toxic by evidence and stated boundaries | unit test |
| 20 | Provenance | Every event logs day, card, choice, outcome, deltas, cause, rolled | engine |
| 21 | Agency under control | Escalations need ≥2 unconditional exits incl. a real "leave" (Walked Away) | tests |
| 22 | Debt and dead ends | Wallet floors at 0, Debt separate, every card has a free choice | validator + ₦0 test |
| 23 | Testing that proves coverage | Seeded scripted runs to all 10 endings, every truth, payoffs, money edges; replay equality | `tests/scripted.test.ts` |

## Status

See `STATUS.md` for what works, what failed during the build, and what's unfinished.

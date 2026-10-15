# WAHALA: LAGOS — MASTER BRIEF (v3, consolidated)

**Status:** This document replaces every earlier brief. It consolidates every decision made so far. The older layered brief is kept only for history in `docs/BRIEF_HISTORY.md`; where anything conflicts, **this document wins**. Supporting files: `docs/LAGOS_LIFE_RESEARCH.md`, `docs/PLAYTEST_1_REVIEW.md`, `design/reference/`, `public/art/`.

**Who this is for:** any builder (Claude Code, another AI agent, or human developers). Read Part 1 before writing a single line of code.

---

## PART 1 — THE GOLDEN RULE

**Wahala is a living world you play, never a questionnaire you read.**

Two playtests failed for the same reason: the player read text and tapped options. The creator's words: *"I didn't feel anything. Read, click, read, click."* Every screen, scene and feature must pass this test:

> Does the player feel they are *doing* something inside a living Lagos, with time moving, people reacting and consequences landing? Or are they reading and choosing?

### The five play rules (apply to everything)

1. **Never tell the player the next step.** No "Take your seat." No "Drink your wine." The world sits there; the player decides.
2. **A clock is always ticking.** Time moves. Waiting is a choice with consequences. Relationships fade if neglected.
3. **Every choice costs something:** money, time, Sanity, trust, Spark, reputation.
4. **Answer with actions and reactions, not lists of sentences.** The player acts in the world (touch, walk, take, give, leave) or reacts with a quick reaction ring. No three-sentence menus.
5. **Show the result.** Faces change, bodies react, voices change tone, money pops, the phone buzzes. The player *feels* the consequence.

### Design rules

- **Show, don't narrate.** Anything mentioned must be on screen. If it can't be shown, cut it.
- **Almost no text.** Never more than about 25 words on screen at once. Short captions under voiced lines only.
- **Everyone speaks.** Characters speak with real voices (see Part 13).
- **Busy world.** People walk, waiters move, cars pass, music plays, phones buzz.
- **Visual hints, not instructions.** Interactable things shimmer or catch the light. The player still has to go and do it.
- **Variety.** Never the same type of action twice in a row.

---

## PART 2 — WHAT WAHALA IS

- **Identity:** a living virtual dating world. Lagos Life is a life simulator where dating is one activity among chores and jobs. In Wahala, every place, activity and system exists for love, attraction, relationships and drama. Work, money, shopping and transport appear only where they feed dating.
- **Two kinds of dating in one world:**
  1. **Story dating (the drama):** pre-built characters (Chief Emeka and the roster) with hidden truths, secrets, moods and arcs.
  2. **Real-player dating (the unexpected):** real people meeting through avatars, flirting, scheming, dating, breaking up. Nothing scripted.
  They collide: Chief calls while you're flirting with a real player at the lounge.
- **Tone:** raw, messy, funny, brutal when it has to be, sweet when it earns it. 18+. No moral lectures; lessons land only on the Verdict Card.
- **Brand:** **Wahala** is the master brand. This game is **Wahala: Lagos** (18+ badge), tagline *"The Dating Survival Sim."* Future cities are Seasons (Wahala: London, Wahala: New York, Wahala: Mumbai…), each unapologetically local. **Wahala High** is a separate, later teen edition with its own content and safety. Never describe the Wahala brand as adult-only.
- **Pillars:** Relationship is the spine · Same character, different story · Every run ends in a share · Raw where it has to be raw · Learn without knowing (the Verdict reveals the red flags you missed).

---

## PART 3 — HOW THE PLAYER ACTS (the control model)

1. **Move:** tap the floor to walk there (pathfinding around furniture), or use an on-screen joystick. Camera follows; drag to look; pinch to zoom.
2. **Interact with objects:** interactable objects shimmer when you're near. Tap one → your avatar walks to it → a small **action ring** appears with 2–4 icon actions (e.g. Rolex: *Try on · Photograph · Leave it*; Chief's phone: *Read · Snap it · Turn face-down*). Behind every action is hidden story logic with consequences that may land days later.
3. **Talk to characters:** characters speak first, out loud, with faces that show their mood. A **reaction ring** of icons appears around them: *Apologise · Blame traffic · Flirt · Hug · Kiss cheek · Laugh it off · Challenge · Say nothing.* Your avatar speaks the line in your chosen voice; the character answers in theirs. No typing with story characters.
4. **Silence is a choice.** Wait too long and the character reacts (Chief gets colder).
5. **Physical moments:** hold to hug, timed tap for a toast or compliment, drag an outfit onto your body, drag your phone into your bag.
6. **Getting stuck:** no instructions. If idle too long, life nudges you the way real life would (your Bestie texts: *"Babe, is his phone just sitting there?? 👀"*).
7. **The phone** is always in your pocket: messages, calls, voice notes, bank alerts, ride app, map, the Parlour, city spots. It buzzes in real time during scenes; you choose to answer, ignore or read later.

---

## PART 4 — TIME AND THE LIVING WORLD

1. **Clock:** an in-game clock runs during play (accelerated; a game day passes in minutes). The HUD shows time of day.
2. **Appointments, not instructions:** your phone shows plans ("Dinner with Chief · 8pm · Ikoyi"). How and when you get there is up to you.
3. **Lateness tiers:** on time · a bit late (5–15 min) · late (15–45) · very late (45–90) · stood him up (90+: he leaves; you arrive to an empty table and a waiter with his bill or his message). Each tier has its own large pool of reactions (see Part 13).
4. **Things happen while you wait:** texts, calls, NEPA takes light, rain, LASTMA, gossip, a rival appears, Chief's mood shifts.
5. **The world is alive:** NPCs walk, eat, argue, dance; cars and danfos move; venues have their own crowds and sounds; day and night change lighting.
6. **Lagos happens to you:** NEPA blackouts mid-date (screen dark, generator kicks in), Third Mainland traffic, Lekki-Epe flooding, LASTMA stopping the car, an okada nearly clipping you. These become story beats.
7. **Between sessions (the hook Lagos Life doesn't have):** with permission, Wahala sends real phone notifications from characters ("Chief: You didn't reply me since morning 🙄"). Characters remember how long you've been away.

---

## PART 5 — RELATIONSHIP SYSTEM

### Visible meters (HUD)
- **Wallet (₦)**, **Sanity (%)**, **Clout (%)**, and a **Spark** meter for your current relationship (hearts or a glowing bar).

### Spark (new, central)
- Spark **fades over time** if you don't tend the relationship. Ignoring texts, being late, being boring, wearing what he hates, never planning anything: it drains.
- Spark rises through good experiences (Part 8), thoughtful actions, matching their Taste, surprises, apologies that land.
- **Spark at zero = you get dumped** (or they ghost you), on any day. Runs can end on Day 1, 2, 3 or 7.

### Hidden values
- **Attachment** (how hooked they are) and **Trust** (how much they believe you). A controlling character with high Attachment becomes more possessive, not nicer.
- **Chemistry:** how your avatar, outfit, makeup, perfume and behaviour match their hidden Taste. Player sees only "+5 Chemistry", never why.
- **Red Flags Shown / Missed**, **Goal Progress**, **Exposure** (risk of leaks).

### Hidden Taste (per character)
Every character has hidden likes and dislikes: body type, style, colours, makeup or no makeup, perfume, punctuality, food, places, humour, how much talking. Two fixed favourites plus one rolled per run. Example: Chief secretly likes makeup and gele; if you show up barefaced he cools slightly, and you won't know why. **Monetisation hook:** buy a clue ("Why did Chief go cold?" → *"Amebo says he noticed you didn't do your face"*). Every body type and look is someone's favourite; no avatar is simply worse. **Wildcard Spark:** ~1 in 6 runs, the character falls for you regardless of Taste.

### Endings (Phase 1)
Locked In (made official; with Chief, "Wife Number Three" on a polygamous run, "The Only One" on the divorced run) · The Counter-Con · Survived Phase 1 · Public Scandal · Sapa Eviction · Public Breakdown · Ghosted/Dumped · Fumbled It (you wrecked a genuinely good one) · Obsession (the only non-roast card: "This one isn't funny. Control isn't love.") · Walked Away.

---

## PART 6 — CHARACTERS AS LIVING PERSONALITIES

### The character bible format (every character, so AI can generate endless believable behaviour)
For each character: name, age, origin, look (canon), voice and speech style (languages, slang, catchphrases), backstory, values, fears, desires, humour, money habits, daily routine, **moods and bad days** (and what triggers them), **hidden Taste**, **hidden truth pool** (3 per character: two flawed, one fake-out), **tells** for each truth (3 each), **behaviour rules** (3–4 applied all run), **experiences they love and hate**, how they apologise, how they fight, how they flirt, deal-breakers, growth arc.

### Chief Emeka, 59 — "The Sponsor" (worked example)
- **Look (canon):** red Igbo cap, red-and-gold traditional outfit, coral beads, grey-flecked full beard, gold watch and ring, heavy-set, distinguished, a little intimidating.
- **Public card:** real estate and import-export, tinted Prado, driver Musa, promises an Ikoyi flat.
- **Signature catch:** flight mode Friday 7pm to Monday; a wife is hunting.
- **Hidden truths:** polygamous household (Locked In means wife number two or three, never first; revealed through the story, never on his intro) · secretly broke, containers stuck at Apapa, needs your name on papers · fake-out: divorced and lonely, the "wife" is his ex.
- **Backstory flavour:** built his money from Onitsha trading; rich but has never really *enjoyed* life. Luxury experiences most people take for granted (a hot air balloon, a jazz night, a road trip, a picnic at the beach) genuinely delight him; that's a hidden path to his heart.
- **Behaviour rules:** punishes public embarrassment; hates being photographed; softens with respect and good food; checks his phone at exactly 9pm.
- **Speech:** English with Igbo and pidgin ("Ehen!", "Nwanyị ọma", "Biko", "Chineke!", "Ọ dị mma").

### Launch roster (11)
**Men:** Chief Emeka, 59 (Igbo, The Sponsor) · Kayode, 28 (Yoruba, The Big Boy) · Bello, 33 (Hausa, The Invisible Heir) · Ovie, 31 (Warri/Delta, The Warri Storm) · Osaze, 30 (Edo, The Returnee).
**Women:** Tiwa, 24 (Yoruba, Soft Life Royalty) · Adaeze, 29 (Igbo, The Heiress) · Zainab, 27 (Hausa, The Quiet Luxury) · Blessing, 26 (Warri/Delta, The Night Queen) · Mercy, 27 (Edo, The Hustle Queen) · Madam Folake, 46 (Yoruba, The Boss Lady).
Hidden truth pools, signature catches and public cards are in the existing character data files (`data/`); keep them. **Balance rule:** no woman's story is only about extracting money, no man's only about conquest; every character has romance, heartbreak, loyalty, manipulation, twists and a real path to a good relationship.
**Cameos (not yet dateable):** Timi (Afrobeats star), Scott (Nollywood actor), Amanda (starlet), Mama Nonso, Musa (Chief's driver), the Bestie, the wife.
**Players are always themselves,** never a roster character. The roster filters by who you date (Men, Women, Both).

---

## PART 7 — THE STORY ENGINE (keep; already built)

1. **Runs:** 7-day Phases (Phase 1 = Days 1–7, the Talking Stage). Future Phases continue weekly like TV episodes.
2. **Why no two runs match:** hidden truth roll (25% Good One, 75% split across the two flawed truths) · shuffled situations (3+ options per beat; Days 2–5 reorder) · dice on risky outcomes · vibe changes first impressions and unlocks options · Chemistry · what you caught or missed · secret goal (Secure the Bag, Real Love, Locked In, Revenge/Chaos) · player actions in the world.
3. **Story memory:** choices and actions set flags; later events pay them off (the Rolex photo becomes his wife's evidence).
4. **Who knows what:** every flag tracks player_knows, partner_knows, world_knows; characters only react to what they could know.
5. **Good Ones are faithful, not perfect.** Actions are tagged cautious (asking, checking once with evidence) or toxic (repeat snooping, public accusations, leaks); only toxic actions wreck a Good One. Context decides.
6. **Agency under control:** controlling partners always offer real exits; Obsession only if you keep choosing to stay.
7. **Economy:** costs scale to starting wallet; budget options beside luxury ones; Loan App debt with later consequences; Wallet and Debt tracked separately; no dead ends.
8. **Honest Receipts:** every Verdict line comes from a logged event (day, action, outcome, money, cause, whether dice decided it).
9. **Testing:** seeded scripted runs reach every ending, truth and payoff; random simulations; same seed + same choices = same result; characters ship only when they pass validation.

The existing decks (all 11 characters) remain the story content. They now play as **situations in the 3D world** (Part 9), not as cards with text options.

---

## PART 8 — DATE EXPERIENCES AND PLACES

Dating happens in real Lagos places, and **where you take someone changes the relationship**. Each experience is a playable activity, not a text result.

| Experience | Real place | What you do | Who loves it |
|---|---|---|---|
| Fine dining | Rooftop restaurant, Ikoyi (off Bourdillon Road) | Dress up, order, toast, read his mood | Chief, Adaeze, Folake |
| Buka date | Mama Put / buka, Surulere or Yaba | Eat amala with your hands, banter, cheap and real | Ovie, Blessing, Good Ones; Tiwa hates it |
| Market and cook | Lekki market / Balogun Market | Haggle for ingredients (slider), cook a meal together at home (cooking mini-game) | Chief, Bello, Mercy |
| Hot air balloon | Lagos sky (sponsorable) | Rise over the lagoon at sunset; hold hands; photo moment | Chief (he's never done anything like it) |
| Beach day | Elegushi Beach / Tarkwa Bay boat ride | Horse ride, beach games, bonfire, sunset walk | Kayode, Blessing, Tiwa |
| Club night | VIP lounge, Ozumba Mbadiwe | Dance-off rhythm game, bottle service, rivals | Kayode, Blessing |
| Road trip | Lekki-Epe Expressway to a beach resort; Badagry heritage trip | Drive, choose music, stop for suya, breakdowns happen | Osaze, Ovie |
| Cinema | Cinema, Lekki | Choose seats, react to the film together | Good Ones, casual daters |
| Gym date | Gym, Lekki Phase 1 | Partner workout challenge | Ovie, Adaeze |
| Book café | Book café, Yaba | Quiz night, talk before looks | Zainab, Bello |
| Owambe | Event centre, Lekki | Spray money, dance, meet family and enemies | Folake, Chief |
| Art night | Gallery, Ikoyi | Pick a painting together | Adaeze, Zainab |

Rules: each experience has costs, a mini-game or physical activity, Chemistry effects based on hidden Taste, and things that can go wrong. Many are **sponsorable** by real businesses (Part 16), with a small button to the real business.

---

## PART 9 — YOUR LIFE (around the dating)

1. **Apartment (Lekki Phase 1):** wardrobe (drag outfits on), **vanity** (actually do makeup: foundation, lips, lashes, gele), mirror (see yourself, Chemistry checks), bed (sleep ends the day), phone.
2. **Getting ready takes time:** hair at the salon, makeup at the vanity, outfit choice. Doing everything makes you late.
3. **Work collisions:** each vibe has a job. You can call in sick to see Chief, but someone may photograph you at the beach and you get a query or sacked; lost salary drains Wallet; low Wallet tempts you to ask Chief for money, which changes how he sees you.
4. **City spots:** Glow Clinic (looks change on your avatar), Salon, Bestie (voiced calls, Genius or Toxic advice), Amebo Network (gossip and clues), Therapist/Deliverance, Club.
5. **Getting around:** order a ride in the phone (Uber-style car, danfo, okada); the vehicle arrives, you walk to it, get in, and ride through the city (Chase/Side/Inside cameras; Skip and Turn back). Fares in game money. Musa drives you when Chief sends him.

---

## PART 10 — SET PIECES (adrenaline)

At least 2 per run, 20–60 seconds, real touch gameplay with sound and a timer:
1. **Wife Escape:** a woman walks into the venue (wife, creditor or ex depending on the hidden truth). 4 seconds to react: hide, stay seated, hold his hand, walk up to her. Hide → move between hiding spots, reach the kitchen door, dodge a bouncer/friend filming/waiter with a tray.
2. **The Salon Showdown:** she finds you under the dryer on Admiralty Way. Pull your wig low and slip out, hold her eye and sip your wine, record and leak her rant, or (Runs vibe) text Chief "₦200k or I talk." Twist by truth: first wife at war · creditor hunting him through you · ex-wife: "You're the new one? Good luck. He's all yours."
3. **Okada Dash:** swipe through Third Mainland traffic to make the date.
4. **Catch the Lie:** spot the mismatch (receipt date, ring mark) before he notices you looking.
5. **The Briefcase:** he steps away; open latches, flip pages, close it before his footsteps return.
6. **The Moment:** hold to hug, timed toast, choose where to sit close; evening getting-ready scenes are sensual and tasteful, never explicit.

---

## PART 11 — THE 3D LIVE CITY

1. **Engine:** Three.js in the existing PWA (keep; already proven). Mid-range Android performance is a requirement.
2. **Characters:** rigged humanoids built with MakeHuman (MPFB, CC0) and animated with Microsoft Rocketbox animations (MIT). Clothing must be separate loose garments that hang naturally (no skin-tight body paint). Accessories attach to bones (a bag is held in the hand). Every model is swappable: professionally made characters (built from the painted Chief reference) will replace stand-ins. Keep `docs/ARTIST_SPEC.md` (format, skeleton, polygon and texture limits) current.
3. **Look:** premium stylized 3D, never blocky; real day/night; rain and wet reflections; Lagos details (danfos, okadas, kiosks, billboards, palms, Link Bridge lights).
4. **Map (Season 1):** Victoria Island, Ikoyi, Lekki first; then the Mainland (Surulere, Yaba, Ojuelegba). Real streets and landmarks only.
5. **Story moments:** the painted character portraits appear as cinematic close-up cutaways during dialogue until 3D faces reach that quality.
6. **NPC life:** crowds with routines (waiters, diners, hawkers, drivers, security), ambient conversations, reactions to events.
7. **Assets:** licensed only; list every source and licence in `docs/ASSETS.md`.

---

## PART 12 — THE REAL-PLAYER WORLD

### Identity and privacy
- In-game identity only by default: username and avatar, no real names, numbers or links. If two players both want to meet for real, they can choose to connect outside Wahala through Tap (opt-in, mutual).
- Players set their status: Single · Open to Dates · Taken (virtual) · Here for Friends · Private. Story romances stay private unless shared.

### Spots (live venues)
- Launch with 4: dating lounge on Ozumba Mbadiwe (the heartbeat), beach bar at Elegushi, café on Admiralty Way, suya spot at Ojuelegba; then hotel rooftop, gym, book café, cinema.
- 30–50 players per venue copy; new copies open when full; friends can join the same copy; busiest venue is highlighted when players are few; AI regulars (always labelled as characters) keep quiet venues alive.
- Walk up to people, sit together, dance, toast, buy virtual drinks, invite to your table.

### Talking
- **Proximity voice:** live, real-time voice like a call. People near you are loud; across the room is faint chatter. At a table or private booth, choose **"Just my table"** (room fades to a murmur) or **"Hear the room."**
- **Text chat** and **voice notes** always available (free alternatives to live voice).
- Live voice can be a coin feature (see Part 15); text and voice notes stay free.

### What makes it unique (the scheming social game)
1. **Personas and secret missions:** each week the game secretly gives every player a mission (e.g. "Get 3 people to buy you drinks," "Win a taken player without being exposed," "Stay faithful 7 days," "Find out which player is secretly a Yahoo Boy"). Every conversation has tension.
2. **Love Meter for real couples:** decays daily; keep it alive with duet mini-games (cook jollof together, dance-off, "how well do you know me"), daily calls, gifts, date nights. Neglect brings temptation.
3. **Loyalty Tests:** secretly hire another player to flirt with your partner and see what happens.
4. **Snatching:** flirt with a taken player; if they switch, the Parlour hears about it.
5. **Receipts:** chats can be leaked to the Parlour with anti-abuse protections.
6. **Wahala Villa:** a weekly live reality show inside the game; players apply, pair up, face challenges; others watch and vote; someone is dumped every few days.
7. **Speed Dating Nights**, **Blind Date Reveal** (both must agree to reveal), **the Wahala Table** (group game debating relationship dilemmas), **AI Bestie matchmaker**, **Relationship Diary** (first meeting, places, photos).
8. **Date invitations:** pick place, activity and transport; the other player accepts, declines or suggests another; then you go together.
9. **Collisions with story dating:** Chief texts during your lounge flirting; friends react; someone says they dated a completely different Chief.

### Safety (required before any real-player feature goes live)
Consent for booths, calls and dates; mute, block and report on everyone; blocking ends all contact and visibility; voice off by default; filtering of abuse, phone numbers, links and payment requests; rate limits; moderation queue with humans reviewing; reported users lose voice until reviewed; no hidden truths revealed between players; age gate.

---

## PART 13 — VOICE AND DIALOGUE

1. **Situation-keyed line pools:** every spoken moment has a key (e.g. `chief.greet.late_15_45`, `chief.reply.blamed_traffic`, `player.excuse.traffic`), with lines varying by hidden truth, mood, vibe and lateness tier.
2. **Huge and always growing:** start with 10–20 lines per situation; keep adding. No code changes to add lines.
3. **No repeats per player** until a pool is exhausted, including across replays.
4. **Pipeline:** AI drafts lines in bulk from the character bible → creator reviews → batch text-to-speech (ElevenLabs or similar, paid plan with commercial rights) → stored audio files → the game plays files. Generated once, never per player.
5. **Voices:** one consistent voice per story character (Nigerian-accented library voice, or a consenting actor's cloned voice with a written licence). Players choose 1 of 3–4 voices for their avatar. Human recordings for hero moments; any line replaceable file-for-file.
6. **Lip movement and expressions** follow the clip; small optional captions.
7. **Future upgrade:** AI-powered conversation where players speak freely and the character answers live. Not in the prototype.

---

## PART 14 — THE LIVING SCRIPT (AI-generated content system)

The goal: characters with so much behaviour that players keep discovering new things, without hand-writing everything.

1. **Character bibles** (Part 6) are the source of truth.
2. **Situation catalogue:** a growing list of situations (lateness tiers, compliments, arguments, apologies, gifts, jealousy, money requests, family pressure, bad days, every date experience, every object interaction, every set piece). For each: triggers, conditions, possible character reactions, effects on meters, flags set.
3. **Generation tools:** scripts that ask an AI to generate situations, reactions and lines for a character from their bible, output in the content schema, run validation (knowledge rules, economy, flags paid off), and queue for creator review.
4. **Daily events:** a procedural layer that schedules surprises (texts, calls, gossip, rivals, Lagos chaos) from the catalogue, weighted by state.
5. **Creator layer:** the creator adds signature storylines and backstories on top.
6. **Sources for inspiration:** Lagos culture, slang and situations; never copy posts verbatim or use real people's names and stories.

---

## PART 15 — MONETISATION

- **Free to play.** Paid moments feel irresistible, never mandatory.
- **Bail-Out** (₦500 / $0.99): revive when Wallet, Sanity or Spark hits zero, once per run.
- **Clues** (₦300 / $0.59): hints, never full answers ("Why did Chief go cold?" → a hint about his hidden Taste; "check who calls him at 9pm").
- **Coins** for: live voice calls with real players, premium outfits and makeup, special date experiences (hot air balloon), gifts, extra Villa votes, Golden Verdict Card.
- **Brands** inside the world (Part 16); affiliate commission on real purchases.
- **Payments** verified on the server only (Paystack via a server function); game money and real money never confused.
- A free path always exists (inviting a friend earns a Bail-Out).

---

## PART 16 — BRANDS AND THE SHOPPABLE WORLD

- **Slots inside the story:** bridge billboards, street posters, club playlist songs, date venue hosts, glow spots, outfit rail, gifts, phone apps (fintech-skinned alerts, ride and food apps), Parlour sponsored post, Verdict Card strip, **date experiences** (hot air balloon company, boat rides, restaurants).
- **Every brand item has merchant data:** merchant_name, real_url, affiliate_url, address, map_url, sponsored, allowed scene tone.
- **Brand safety:** brands only in positive or neutral scenes, never next to raids, scams, cheating reveals or breakdowns. Scandal scenes use real streets with descriptive venues, never named real businesses.
- **Empty slots advertise themselves** ("Your brand here — advertise on Wahala").
- **Advertise page:** audience stats, slot previews, rate card (from ₦10K/week street poster to ₦250K/week Verdict strip), self-serve booking with Paystack, approval queue, brand dashboard.
- **Later:** boutiques and a mall with real brands' items; merchant onboarding with approval; real purchase codes unlock the virtual item.

---

## PART 17 — VIRAL LOOP

- **Verdict Card** and **Wahala Receipts** at every run end (honest, from logged events), downloadable (9:16 and X size), shareable to WhatsApp, X, IG; share links with "Date [character] yourself" and "Beat their score."
- **The Parlour:** live gossip feed (real counts only; NPC gossip labelled), receipts, reactions, rivalry alerts, Hall of Fame/Shame.
- **Squad Runs** and friend dares ("Lock In Blessing under ₦100k"), **Cheapest Win** leaderboard.
- **Phase 2 cliffhanger** with opt-in notification (no data collected from under-18 path).

---

## PART 18 — HOW WAHALA BEATS LAGOS LIFE

| Lagos Life | Wahala |
|---|---|
| Life sim; dating is one activity | Everything built around dating, drama and relationships |
| Blocky 3D | Premium stylized 3D with realistic animated people |
| Menu actions, needs bars | Touch, react, move; Spark that fades; no chores |
| Characters are players and simple NPCs | Deep story characters with secrets, moods and memory |
| Chat | Proximity live voice, private tables, voice notes |
| No story, no ending | Story arcs, set pieces, endings, Verdict Cards |
| Billboards beside the road | Brands inside experiences (dates, gifts, venues) |
| Game stops when you close it | Characters text your real phone and remember you |
| Hackable economy (reported) | Server-validated money and rewards |
| Copycats copy cities | Our moat: characters people argue about, the Villa, the scheming |

Wow features to protect: proximity voice, Spark decay, hidden Taste with buyable clues, living characters with memory and bad days, real-phone messages from characters, Wahala Villa, secret missions, loyalty tests, date experiences with real brands.

---

## PART 19 — ART, AUDIO AND NAMES

- **Visual identity:** black base, red primary, gold display type, emerald for money, hot pink for Clout, crimson for red flags. Reference screens in `design/reference/` (opening with Chief, a younger man and a woman; age gate; women's and men's avatar builders with 12+ skin tones, diverse hair including natural, low cut, braids, locs; body types including Average Guy, Big Daddy, Tall and Slim; everyday outfits on previews).
- **Chief canon art:** `public/art/chief_*.webp` (6 expressions + seated restaurant) and `design/reference/04_chief_character_sheet.png`.
- **Sound:** layered per location (chatter, cutlery, horns, conductors, generators, Afrobeats through walls); rain only when raining; UI sounds for cash, alerts, reveals; mute toggle.
- **Real names policy:** every street, area, landmark, bridge, market, agency and food is real Lagos. People have realistic Nigerian names; no real public figures. Real businesses appear by name only in neutral/positive scenes or as paid placements.
- **Age gate:** "Wahala: Lagos is an 18+ interactive story game with romance, secrets and choices that have consequences." No path: "Wahala High is coming. Follow us for news." with no data collected.

---

## PART 20 — TECH, SECURITY, TESTING

- **Stack:** React + Vite PWA; Three.js for 3D; Supabase (auth, Postgres, Realtime for presence and chat, Edge Functions); LiveKit (or similar) for voice; Paystack with server verification; Vercel hosting; analytics events from hour one.
- **Performance:** mid-range Android over 3G is the target; compressed assets, LODs, streaming, reduced effects on weak devices; the story keeps playing if servers struggle.
- **Security:** money, purchases, stats, rewards and leaderboards validated on the server; keys only in environment settings.
- **Testing:** keep all existing tests and the 23 engine rules; add tests for Spark decay, lateness tiers, no-repeat dialogue, object interactions, and real-player safety tools. Report real results; never claim untested things work.

---

## PART 21 — BUILD ORDER (from now)

1. **Finish the 3D proof scene** (in progress): apartment (wardrobe, vanity, mirror, bag in hand) → ride across the Link Bridge → restaurant → Chief walks in, sits, toasts. Fix Chief's outfit (loose garment, straight trousers) and beard.
2. **Chief's first date in 3D, fully playable** using Parts 1, 3, 4 and 5: clock and lateness tiers, reaction ring, object action rings (Rolex, phone, briefcase), Spark meter, voiced lines (AI voice pipeline), Wife Escape. Acceptance: the creator plays on her phone and feels she's living it.
3. **Chief's full 7 days in 3D,** with 3+ date experiences (fine dining, buka, hot air balloon), the Salon Showdown, work collisions, real-phone notifications.
4. **Live City** (VI, Ikoyi, Lekki) with rides, NPC life and venues.
5. **Spots and real players:** presence, chat, proximity voice, safety tools, date invitations, Love Meter, secret missions.
6. **More characters** converted to 3D and the living script, then Phases 2+, The Chase, the Villa, more cities.

## PART 22 — ROADMAP (after launch)
The Chase (win a character before dating them) · Phases 2+ (Situationship, Meet the Family, Moving In, Wedding) · Wahala Villa seasons · boutiques and mall · couples' shared home · AI-powered free conversation with characters · new Seasons (London, New York, Mumbai…) with cross-city relocation (buy a ticket, your history follows you) · Wahala High.

## PART 23 — ACCEPTANCE TESTS
1. The creator plays on her phone and never feels she's reading a questionnaire.
2. Time moves, and doing nothing has consequences.
3. Characters speak, react with faces and bodies, and remember.
4. Two players dating Chief describe different experiences.
5. A player wants to replay or show someone what happened.

---

## PART 24 — THE CHARACTER BRAIN (how characters think)

Modelled on how The Sims' AI works (as described by its former lead AI programmer), adapted for relationships.

1. **Needs/motives, not scripts.** Each character has motives that rise and fall over time: Pride, Attention (from you), Desire, Money Stress, Family Pressure, Fun, Jealousy, Rest. The lower or more urgent a motive, the more it drives behaviour (curves, not on/off).
2. **The world advertises.** Objects, places and people advertise what they satisfy ("wine: Fun +", "your compliment: Pride +", "his phone: Money Stress relief / Family Pressure"). Each moment the character picks a high-scoring action with some randomness. Result: Chief checks his phone when stressed, orders more wine when happy, tells Onitsha stories when relaxed, sulks when ignored, without anyone scripting "now do this."
3. **Moodlets (temporary tags):** "You were late," "Saw your Instagram," "Embarrassed in public," "Tipsy," "Missing you," "Bad day at the port," "Wife called." They change which actions are allowed, how reactions are weighted, and they expire.
4. **Long-term vs short-term feelings.** Spark, Trust and Attachment are long-term. **Vibe of tonight** is short-term ("I love you but I'm vexed right now"). Reactions weigh both.
5. **Situations fill themselves.** A date, a party, an owambe, a club night is a Situation with roles (waiter, diners, DJ, bouncer, rival, wife, friends). The engine fills roles with existing characters or generates townies.
6. **Reactive, not planning.** Characters live in the moment so players understand why they act. **The player makes big decisions** (confront, leave, accept being wife number three, move in, break up); the brain handles small behaviour.
7. **Life continues off-screen** at low detail: Chief travels to Abuja, containers clear or don't, his money and mood change, his children call him. This feeds real-phone messages and changes how he greets you next time.
8. **Every character** in the roster and every future character uses the same brain with their own motives, weights, Taste and moodlets from their character bible.

## PART 25 — REAL RELATIONSHIP DYNAMICS

1. **Both sides mess up.** Characters also annoy, hurt, forget, cheat, lie, overpromise. Sometimes they are right, sometimes wrong. They may apologise, refuse, or apologise badly. You can demand an apology, sulk, forgive, escalate, or let it go. Unresolved fights leave moodlets that resurface.
2. **Fights and make-ups** are playable: cold shoulder, silent treatment on the phone, a gift to make up, an experience to reset, a friend or pastor to mediate.
3. **Chief's world (example of depth for every character):**
   - **Family:** wives (on polygamous runs), **children** (teens and adults) whose approval you can win or lose; family WhatsApp group; village meetings.
   - **Side pieces:** he may have others; rivals appear in the Parlour, at parties, at the salon.
   - **Business:** Onitsha and Apapa containers, deals, debtors; good weeks make him generous, bad weeks make him moody and broke.
   - **Promises:** big money promises (₦2m, a car, an Ikoyi flat) that may come true, partly come true, or never come.
   - **Status life:** parties, owambes, his friends, bodyguards, his own social media, the club, golf or tennis at a members' club.
   - **Gifts and lifestyle:** boutiques, jewellery, gold, a car from a car mart, a house via a real estate agent.
4. **Your options are wide:** pray with your pastor for him to love you, consult your Bestie, investigate, report serious wrongdoing to the police, take him on experiences he's never had, post him (or not) on social media, meet his children, crash his party, throw your own party and see if he comes.
5. **Getting dumped (rules):**
   - **Warning signs first:** shorter replies, late replies, cancelled plans, "I'm in a meeting," Spark visibly dropping, friends hinting.
   - **Triggers:** Spark reaches zero; a deal-breaker for that character (Chief: public humiliation, posting him after "no pictures," disrespecting his children); repeated toxic actions; being caught with someone else.
   - **Last chance (monetisation):** when you're about to be dumped, a "Save it" moment: buy a gift, book a special experience, or use a Bail-Out to buy one more chance. It must feel like a real-life rescue, not a paywall.
   - **Dumping is a scene**, not a text: the voice note, the blocked number, the bodyguard returning your things, or the cold dinner where he says it to your face.
6. **The verdict:** every run ends with the Verdict Card and Receipts, shareable to Instagram, WhatsApp, X and TikTok.

## PART 26 — YOUR LIFE AND ECONOMY (relationship-first)

No hunger or bladder bars; eating, sleeping and hygiene are assumed. Everything else in life exists because it affects love.

1. **Choose your job at the start** (salary sets your starting lifestyle): banker, nurse, POS agent, lawyer, content creator, sales rep, hairstylist, tech worker, civil servant, trader, student-with-hustle, unemployed "between jobs." Each job has a schedule, a boss and collisions (boss keeps you till 9pm the night of the date; calling in sick and being spotted at the beach; promotion pressure).
2. **Lifestyle must match income:** your apartment, furniture, electronics, car and outfits are bought with money you actually have. A ₦150k-a-month earner can't furnish a Banana Island flat, unless someone else is paying, and that changes the relationship.
3. **Why are you dating?** Your secret goal (money, love, ring, revenge, attention, care) shapes temptations and the Verdict.
4. **Ways to make and lose money:** salary, side hustles, gifts and transfers from partners, selling gifts, Loan App debt, investments that can crash, being robbed or scammed, spending to keep a relationship alive.
5. **Things to buy (all sponsorable):** clothes, makeup, perfume, hair, jewellery and gold, electronics, furniture, cars at a car mart, property via a real estate agent who may stop you on the street, gifts for partners, experiences.
6. **Leisure in real Lagos:** football viewing centres, five-a-side, tennis, the gym, beaches, concerts, comedy shows, cinema, art galleries, owambes, clubs, church and mosque events, markets.
7. **Social media inside the game:** post photos, gain followers and Clout, get exposed, go viral, get dragged; partners react to what you post.

## PART 27 — FAST-TRACK TECHNOLOGY (to build faster and look premium)

The creator is willing to buy assets and services to reach quality faster. Use these, with licences recorded in `docs/ASSETS.md`.

1. **Realistic characters from a single image:** photo-to-avatar services (for example Avatar SDK's MetaPerson, or Avaturn) generate realistic, full-body, rigged avatars with facial blendshapes, exported as GLB and compatible with standard animation libraries, with web SDKs. Use them to:
   - Build **story characters** from our painted reference art (Chief's portrait first), then add outfits and details.
   - Optionally let **players create their avatar from a selfie** (opt-in, privacy policy, never stored longer than needed, and players may only upload their own face).
   - Check pricing and licence terms for commercial game use before committing; test quality on Chief first.
2. **Products from photos:** AI image-to-3D services (for example Meshy, Tripo, Hunyuan 3D) turn a product photo into a textured GLB in seconds, at low cost per model. Use for merchant items (watches, bags, dresses, cars, furniture) after merchant approval.
3. **Real places from video:** Gaussian splatting turns a walkthrough video into a photoreal 3D scene that can render in the browser on top of Three.js (for example with the Spark renderer). Use for showcase venues (a sponsoring hotel's lobby or restaurant) where photoreal matters; keep the main city as optimised meshes for phone performance.
4. **Buy, don't build, where sensible:** licensed packs for buildings, cars, furniture, props and animations from reputable marketplaces; better animation sets (talking gestures, seated interactions, dancing).
5. **Rules:** never create a 3D likeness of a real person without their consent; merchants own and approve their twins; every asset licence tracked.

## PART 28 — MERCHANT DIGITAL TWINS (shoppable world, made automatic)

1. A merchant uploads photos (or a video for venues), name, price, link and location.
2. The system generates a 3D twin (image-to-3D for products, Gaussian splatting or modelled interiors for venues), styled to fit Wahala.
3. The merchant previews and approves; nothing goes live unapproved.
4. Players see and use the twin in-game (wear the watch, drive the car, dine at the hotel), with a small "See the real one" button to the merchant's page (affiliate link where possible).
5. Billing via the Advertise page; reports show views, try-ons, taps and purchases.
6. Build the data model and upload/approval flow early; automate generation once the core game is proven.

## PART 21 (UPDATED) — BUILD ORDER

1. **Finish the 3D proof scene** with current stand-ins.
2. **Test the realistic-character fast track:** generate Chief from his painted portrait using a photo-to-avatar service; compare with the MakeHuman Chief on a phone; choose the better pipeline for all characters.
3. **Build the Character Brain (Part 24)** for Chief, plus Spark, moodlets, lateness tiers and the reaction ring, inside the first date.
4. **Chief's first date and full 7 days in 3D** with date experiences, real relationship dynamics (Part 25), job collisions and dumping rules.
5. **Live City and life economy** (Parts 11 and 26).
6. **Spots and real players** (Part 12), with safety.
7. **Merchant upload and approval flow** (Part 28), then automated twins.
8. **Remaining characters** using the same brain and pipeline.

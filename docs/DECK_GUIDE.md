# Writing a character deck

How to write a Wahala character so it passes the launch gate. `data/cities/lagos/cards/chief_emeka.json` is the worked example; read it in full before writing. `docs/BRIEF.md` is the spec (later sections override earlier ones). `src/engine/types.ts` defines every field.

## Files you own per character

- `data/cities/lagos/cards/<id>.json`: the deck (array of cards).
- `data/cities/lagos/characters/<id>.json`: an extension merged over the character's entry in `characters.json`. It must contain `cold_open` and `endings`. It can also override `vibe_start`, `rules`, `truths` (replace the whole array), `chemistry_leaks` or `look`. Top-level keys replace; `endings` merge by key. **Never edit `characters.json`, `shared.json`, the engine or the tests.** If something blocks you there, report it.

## Minimum matrix (validator enforced)

Aim higher than the floor, around 22 to 26 cards:

| Slot | Minimum |
| --- | --- |
| `first_date` | 3 |
| `red_flag` | 3 |
| `money_trap` | 3 |
| `confrontation` | exactly 1 per truth, each with `requires.truth: [<truth>]` (3 total) |
| `payoff` | 2 or more, each with `payoff_of` naming flags set earlier |
| `talking_time` | 3 or more (aim for 6, one per day 2 to 7) |
| `public_drama` | 2 to 3 own cards (otherwise the shared deck fills it) |
| `escalation` | 3 or more, required if `temperament.controlling` is true |

Escalation cards follow rule 21. Each needs at least 2 unconditional choices tagged `exit`, one of them with an outcome `"end": "walked_away"`. Choices tagged `stay` are the only route to Obsession, and control must read as frightening, never romantic.

## Card rules

- **Every card** needs: `scene` (location from `locations.json`, `time`, `expression` from the character's expressions, `mood` positive/neutral/negative, optional `npc` and `partner_present`), `beats` (setup under 45 words, not counting the tell), and at least 3 unconditional choices.
- **At least one choice must be free and unconditional** (no `cost`, no `requires`, no `vibe`), so ₦0 is never a dead end.
- **Tells:** every non-talking-time, non-escalation, non-payoff character card has `tells` covering each truth it can appear under. Use `{ "id": "<tell id from that truth>", "text": "card-specific wording" }`, and put `{tell}` in a narration beat.
- **Choices:** labels under 12 words. Add a vibe-only option (`"vibe": "runs"`, labelled `[Runs] ...`) where it fits. Every choice must be tempting.
- **Outcomes:** each list's `chance` sums to exactly 1. Mark the worse dice branch `"bad": true` and lies `"tricked": true`. Give every choice a `receipt` in second person ("You sent her ₦50k for lashes.").
- **`truth_override`** keys are this character's truth ids (or `good_one` / `flawed`). Use overrides so the same choice plays differently per hidden truth: that is the heart of the game.
- **Tags:**
  - `cautious`: asking directly, verifying once, setting a boundary.
  - `toxic`: snooping again, public accusations, leaking unverified gist, revenge.
  - `investigate`: the engine decides cautious vs toxic from evidence and boundaries.
  - `excuse`: ignoring a tell, which counts as a Red Flag Missed.
  - The rest: `luxury`, `budget`, `public_embarrassment`, `discreet`, `independence`, `contact_partner`, `call_out`, `stay`, `exit`.
- **A `luxury` choice needs an unconditional `budget` choice on the same card.**
- **Flags (rule 1):** every flag you `set` must be read later by some card or choice (`requires.flags`, `any_flags`, `partner_knows`, `knows`, `flag_age`, `payoff_of`). Flags starting with `secret_` are the player's secrets; the Amebo can sell them.
- **Knowledge (rules 13, 18):** set `knows: ["player", "partner", "world", ...]`. If the partner speaks about a player secret, the card needs `requires.partner_knows`, or `discovers` (the card delivers the news), plus `partner_reacts_to`.
- **Counter-Con** needs `"saw_truth": true` on some flawed-truth outcomes, and big money (net +₦750k). **Revenge** needs `"truth_exposed": true` on public exposure outcomes.
- **Talking Time:**
  - `presentation` is `voice_note` or `text`, with `partner_present: false`.
  - `detail: { "flag": "knows_x", "missed": { "chemistry": -3 }, "red_flag": <true if missing it hides a real warning> }`.
  - One reply has `"caught": true` and gives `"trust": 4` (this is how deliberate players earn trust). Every `knows_x` flag must unlock a choice on a later card.
- **Payoffs:** use `flag_age` so they land a day or more later, and a `not_flags` guard flag set by every choice so they play once.
- **Real names policy:**
  - real streets and areas only (Admiralty Way, Ozumba Mbadiwe, Awolowo Road, Allen Avenue, Ojuelegba, Yaba, Ikeja GRA, Third Mainland Bridge, Lekki-Epe Expressway, Balogun, Computer Village, and so on)
  - no named real business in a `negative` scene: use "a rooftop lounge in VI"
  - realistic Nigerian names for every person, and no real public figures
- **Pidgin** where a real person would use it, never forced. Make it funny, savage and specific: "He sent ₦50k and a voice note of him praying for you."

## Balance rule (brief)

- No woman's storyline is only about extracting money, and no man's is only about conquest.
- Every character offers romance, heartbreak, jealousy, genuine affection, manipulation, loyalty and twists.
- There is a believable path to Locked In, especially on the Good One run.
- Everyday Nigerian dating humour works for both sides: transport money, "I'm coming with my friends", the third sister's birthday, the account number before the first date.
- Ego and pride choices (flex, play hard to get, refuse to pay, accept being kept) carry real consequences.
- Rivals can appear: another man or woman competing for the partner.

## Extension file shape

```json
{
  "id": "tiwa",
  "cold_open": {
    "duration": 15,
    "scene": { "location": "lekki_salon", "time": "golden", "expression": "charming", "mood": "neutral" },
    "phone": [{ "at": 1.5, "kind": "text", "from": "Tiwa", "text": "..." }],
    "beats": [{ "at": 0.5, "who": "narration", "text": "..." }, { "at": 6, "who": "partner", "text": "..." }]
  },
  "endings": {
    "locked_in": { "title": "...", "text": "...", "scene": { "location": "...", "time": "night", "expression": "happy", "mood": "positive" }, "truths": { "<truth id>": { "title": "...", "text": "..." } } },
    "counter_con": {}, "survived": {}, "scandal": {}, "sapa": {}, "breakdown": {}, "ghosted": {}, "fumbled": {}, "obsession": {}, "walked_away": {}
  }
}
```

- **Cold open:** 10 to 20 seconds, makes the player curious, and never reveals the hidden truth.
- **Endings:** write all 10. `obsession` only matters for controlling characters, and its text is never a joke.

## Definition of done (run these yourself)

1. `npx tsx scripts/validate-content.ts`: your characters print `PASS` (this includes every ending and every card being reached in 3,600 simulated runs).
2. `npx tsx scripts/reach.ts <id>`: at least 20/40 for every vibe (deliberate play reaching Locked In). If one is low, add trust-earning content (caught details, cautious honest choices, good-one overrides) or warm `vibe_start` a little.
3. `npx vitest run`: all tests pass.
4. `npx tsc --noEmit`: clean.

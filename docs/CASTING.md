# Casting (brief Part 29)

The rule is Part 29 of the brief. In short: main characters, player avatar options and the large
majority of NPCs in Lagos are Black African with authentic African features (face shape, hair
textures, styling), from very dark to light-skinned. Non-African people appear only as a small share
of background characters (expats, tourists, business visitors), never in story roles. Rocketbox's
non-African models are reserved for future Seasons; its Black models may be Lagos background
characters now.

The validator enforces this from `src/three/cast.ts`. "A small share" is read as at most 15% of a
scene's background cast, always allowing one.

## Rocketbox audit (all 111 adult avatars reviewed)

| Avatar | Reads as | Use in Lagos |
| --- | --- | --- |
| Business_Female_01 | Black African woman, smart clothes | **Player stand-in** (temporary: Part 29 keeps Rocketbox to background roles, so the portrait pipeline replaces her as the player) |
| Pilot_Female_02 | Black African woman, cabin-crew uniform | Diner (off-duty crew), airport scenes |
| Male_Adult_04 | Black African man, casual | Diner |
| Male_Adult_12 | Black African man, casual | Waiter |
| Male_Adult_18 | Black African man, hoodie | Diner, street crowd |
| Construction_Male_03 | Black African man, hard hat | Building sites only |
| Military_Male_01, Military_Male_06 | Black African men, army uniform | Checkpoints only |
| Fire_Male_06, Fire_Female_01, Fire_Female_02 | Firefighters in helmets | Emergencies only |
| Female_Party_02, Business_Male_05, Male_Adult_17, Sports_Male_03, Female_Adult_11 | Ambiguous, not clearly African | **Not used in Lagos** (were in the first restaurant build; replaced) |
| Everyone else | Not African | Background expats only, or future Seasons |

**The gap:** Rocketbox has only two clearly Black African women, and few Black men in everyday
clothes. Part 29.4 fills it: a library of fictional Nigerian face portraits (varied ages, ethnic
groups, skin tones and hairstyles; never real people), turned into rigged 3D people with the
photo-to-avatar or Meshy pipeline and dressed in Lagos fashion: ankara, agbada, senator, kaftan,
gele, corporate wear, streetwear, and uniforms for waiters, security, drivers and hawkers. Each is
rigged to a Mixamo skeleton so they share the animation libraries with everyone else.

## Adding a person

Every entry in `src/three/cast.ts` declares `heritage` (`black_african` or `non_african`) and `role`
(`story`, `player`, `npc`, `background_expat`). A non-African person can only have the
`background_expat` role.

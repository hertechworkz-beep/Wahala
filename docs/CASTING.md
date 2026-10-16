# Casting (brief Part 29)

Lagos is cast Black African: main characters, player avatar options and almost all NPCs, across the
full range of skin tones. Non-African people appear only as a few background expats or tourists
(at most two per scene), never in story roles. The validator enforces this from `src/three/cast.ts`.

## Rocketbox audit (all 111 adult avatars reviewed)

| Avatar | Reads as | Use in Lagos |
| --- | --- | --- |
| Business_Female_01 | Black African woman, smart clothes | **Player stand-in** |
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
clothes. Lagos needs far more variety (ages, builds, skin tones, styles: ankara, agbada, kaftan,
office wear, street wear). That comes from the creator's Nigerian face portraits through the
photo-to-avatar (MetaPerson) or Meshy pipeline, rigged to a Mixamo skeleton so they use the same
animation libraries as everyone else.

## Adding a person

Every entry in `src/three/cast.ts` declares `heritage` (`black_african` or `non_african`) and `role`
(`story`, `player`, `npc`, `background_expat`). A non-African person can only have the
`background_expat` role.

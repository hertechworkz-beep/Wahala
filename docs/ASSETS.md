# 3D assets and licences

Every 3D asset in the game, where it comes from, and its licence. All of them can be replaced by commissioned Wahala art without changing the game code: characters load from `public/models/*.glb`, and their animation clips are listed beside them in `*.clips.json`.

## Characters

### Chief Emeka (in game): the Meshy model

| Asset | Source | Licence | Notes |
| --- | --- | --- | --- |
| Model, textures and skeleton | Made by the creator with [Meshy](https://www.meshy.ai) ("Regal Crimson Heritage"). The original file is kept in `art-src/chief/chief_meshy_source.glb` | Per the creator's Meshy plan (see below) | Agbada with gold embroidery, coral beads, red cap and loafers; 15,146 vertices; Mixamo-standard skeleton with 66 joints |
| Walk, run and seated-talk clips | Came with the Meshy file | As above | Renamed in game to `walk`, `run` and `sit_talk` |
| Idle, sit down and stand up, seated idles, wave, talk, drink, phone call, cheer, clap, invite-to-sit and two dances | [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) animation library | MIT, © 2020 Microsoft | Retargeted onto the Meshy skeleton by `tools/characters/retarget.py` |
| Hand weight fix | `tools/characters/fix_meshy_weights.py` | Ours | Meshy's automatic rig let the thigh and hip bones pull on the hands, so 1,338 vertices are corrected |

**Meshy licence: please confirm your plan.** As we understand Meshy's terms, models made on a paid plan are yours to use commercially and privately, while free-plan models are released under CC BY 4.0, which means public credit to Meshy. Please check which plan made this model. If it's the free plan, we'll add the credit to the in-game credits.

### Earlier stand-in (kept for reference, not used in game)

Our first Chief was built with MakeHuman (CC0) through MPFB2: `tools/characters/build_chief.sh`. It is no longer loaded.

The MIT licence requires keeping Microsoft's copyright notice. It is reproduced here and will appear in the in-game credits:

> Copyright (c) 2020 Microsoft. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

## Environments and props

| Asset | Source | Licence |
| --- | --- | --- |
| Armchair, side table, wine glass, speaker, floor, rug, walls and lamp | Modelled in code (`src/three/props.ts`) | Ours |

## Tools (not shipped)

- **Blender 5.2** (the `bpy` Python module): GPL. Used only to build the assets.
- **glTF-Transform**: MIT. Used to compress the models.
- **Three.js**: MIT. This one ships with the game as the 3D engine.

## Pending (requested from the creator)

- **MakeHuman system assets** (CC0): realistic eyebrows, eyelashes and hair, plus clothes for the player avatars.
- **An SUV for Musa's car**, from Sketchfab, licensed CC0 or CC-BY. The artist will be credited here.

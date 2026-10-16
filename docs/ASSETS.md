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

**Meshy licence:** made on the creator's paid Meshy plan, so the model is ours to use commercially; no public credit is required.

### The restaurant cast: Microsoft Rocketbox avatars

| Who | Avatar | Licence |
| --- | --- | --- |
| You (stand-in until the player avatar system) | `Business_Female_01` | MIT, © 2020 Microsoft |
| Diners | `Male_Adult_04`, `Male_Adult_18`, `Pilot_Female_02` (off-duty crew) | MIT |
| Waiter | `Male_Adult_12` | MIT |

Casting follows brief Part 29 (see `docs/CASTING.md`): only Rocketbox's Black African avatars are used in Lagos.

Each uses the avatar's "facial" export, keeping its 52 ARKit expression shapes and 15 lip-sync visemes. Two shared animation libraries (female and male) of Rocketbox clips drive every avatar on the Biped skeleton: idles, walk, run, chair and table sitting, standing up, carrying a bag, drinking, talking, listening, laughing, phone, dancing and more. Built by `tools/characters/build_rocketbox_people.sh`.

### Earlier stand-in (kept for reference, not used in game)

Our first Chief was built with MakeHuman (CC0) through MPFB2: `tools/characters/build_chief.sh`. It is no longer loaded.

The MIT licence requires keeping Microsoft's copyright notice. It is reproduced here and will appear in the in-game credits:

> Copyright (c) 2020 Microsoft. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

## Environments and props

| Asset | Source | Licence |
| --- | --- | --- |
| Armchair, side table, wine glass, speaker, floor, rug, walls and lamp | Modelled in code (`src/three/props.ts`) | Ours |
| Restaurant: round tables with cloths, dining chairs, place settings, candles, bar with bottles, plants, pendant lamps, doors, marble floor, panelled walls, handbag | Modelled in code (`src/three/props.ts`, `src/three/venue.ts`) | Ours |
| Walkable floor (navmesh) | Generated at runtime by [recast-navigation](https://github.com/isaac-mason/recast-navigation-js) | MIT |

## Tools (not shipped)

- **Blender 5.2** (the `bpy` Python module): GPL. Used only to build the assets.
- **glTF-Transform**: MIT. Used to compress the models.
- **Three.js**: MIT. This one ships with the game as the 3D engine.

## Pending (requested from the creator)

- **Musa's SUV:** to be generated with Meshy (`tools/meshy/jobs/prado.json`) once `MESHY_API_KEY` and `api.meshy.ai` reach the environment; a code-built SUV stands in until then.
- **MetaPerson Chief:** coming from the creator's team, for the realistic-character comparison.

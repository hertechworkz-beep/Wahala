# 3D assets and licences

Every 3D asset in the game, where it comes from, and its licence. All of them can be replaced by commissioned Wahala art without changing the game code: characters load from `public/models/*.glb`, and their animation clips are listed beside them in `*.clips.json`.

## Characters

| Asset | Source | Licence | Notes |
| --- | --- | --- | --- |
| Chief Emeka body | [MakeHuman](https://github.com/makehumancommunity/makehuman) base mesh and targets, via [MPFB2](https://github.com/makehumancommunity/mpfb2) | CC0 1.0 | Built by script (`tools/characters/chief_base.py`): male, age 59, African, heavy build, belly, fuller neck and cheeks |
| Chief's eyes | MakeHuman "low-poly" eyes and brown eye texture | CC0 1.0 | The iris is recoloured to a deep brown |
| Chief's skeleton | MPFB2 `game_engine` rig | CC0 1.0 | 53 bones, including fingers |
| Chief's facial expressions | MakeHuman expression units (African set): mouth-open, eye-closure and mouth-corner-puller | CC0 1.0 | Used for speaking, blinking and smiling |
| Chief's skin texture and age lines | Generated in Blender by our scripts | Ours | |
| Beard, eyebrows and hair | Generated in Blender by our scripts | Ours | Built as layered strand shells |
| Cap, coral beads, senator outfit, shoes, watch and ring | Modelled and textured by our scripts | Ours | |
| Animations | [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) animation library | MIT, © 2020 Microsoft | Retargeted onto the MakeHuman rig by `tools/characters/retarget.py`. Clips: idle, walk, sit down, sit idle, stand up, wave, talk, drink idle, drink and invite-to-sit |

The MIT licence requires keeping Microsoft's copyright notice. It is reproduced here and will appear in the in-game credits:

> Copyright (c) 2020 Microsoft. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

## Environments and props

| Asset | Source | Licence |
| --- | --- | --- |
| Armchair, side table, wine glass, floor, rug, walls and lamp | Modelled in code (`src/three/props.ts`) | Ours |

## Tools (not shipped)

- **Blender 5.2** (the `bpy` Python module): GPL. Used only to build the assets.
- **glTF-Transform**: MIT. Used to compress the models.
- **Three.js**: MIT. This one ships with the game as the 3D engine.

## Pending (requested from the creator)

- **MakeHuman system assets** (CC0): realistic eyebrows, eyelashes and hair, plus clothes for the player avatars.
- **An SUV for Musa's car**, from Sketchfab, licensed CC0 or CC-BY. The artist will be credited here.

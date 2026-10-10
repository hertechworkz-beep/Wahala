#!/usr/bin/env bash
# Rebuilds Chief Emeka's 3D model (public/models/chief.glb) from free sources.
# Needs: Python 3.13 with the `bpy` wheel (Blender 5.2 as a module), and three clones:
#   MPFB2      https://github.com/makehumancommunity/mpfb2              (MakeHuman for Blender, CC0 assets)
#   MakeHuman  https://github.com/makehumancommunity/makehuman          (eyes, CC0)
#   Rocketbox  https://github.com/microsoft/Microsoft-Rocketbox         (animations, MIT)
# Usage: PY=/path/to/python MPFB_SRC=.../mpfb2/src/mpfb MH_DATA=.../makehuman/makehuman/data ROCKETBOX=.../Microsoft-Rocketbox tools/characters/build_chief.sh
set -euo pipefail
cd "$(dirname "$0")"
W=${WORK:-/tmp/wahala-chief}; mkdir -p "$W"
"$PY" chief_base.py "$W/base.blend"
SKIN_RES=${SKIN_RES:-1024} "$PY" chief_dress.py "$W/base.blend" "$W/dressed.blend"
envsubst < chief_clips.template.json > "$W/clips.json"
"$PY" retarget.py "$W/dressed.blend" "$W/clips.json" "$W/chief.glb"
npx gltf-transform optimize "$W/chief.glb" ../../public/models/chief.glb --compress meshopt --texture-compress webp --texture-size 1024 --simplify false --join false --flatten false
cp "$W/chief.clips.json" ../../public/models/chief.clips.json

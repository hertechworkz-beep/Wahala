#!/usr/bin/env bash
# Builds the in-game Chief (public/models/chief.glb) from the approved Meshy model.
#   1. import the Meshy GLB and drop its helper sphere
#   2. fix Meshy's auto-rig: hands no longer follow the thighs/hips
#   3. keep Meshy's walk/run/seated-talk clips and add Rocketbox clips (MIT) retargeted onto the
#      Mixamo skeleton (fingers excluded: the game poses the grip in code)
#   4. compress for phones (meshopt + WebP, 2048 textures)
# Needs PY (Python with the bpy wheel) and ROCKETBOX (a clone of microsoft/Microsoft-Rocketbox).
set -euo pipefail
cd "$(dirname "$0")"
W=${WORK:-/tmp/wahala-chief-meshy}; mkdir -p "$W"
"$PY" import_glb.py ../../art-src/chief/chief_meshy_source.glb "$W/meshy.blend"
"$PY" fix_meshy_weights.py "$W/meshy.blend" "$W/meshy_fixed.blend"
envsubst < chief_meshy_clips.template.json > "$W/clips.json"
SKIP_FINGERS=1 TARGET=mixamo KEEP="Walking:walk:1.326,Running:run:4.2,Sitting_Answering_Questions:sit_talk:0" \
  "$PY" retarget.py "$W/meshy_fixed.blend" "$W/clips.json" "$W/chief.glb"
npx gltf-transform optimize "$W/chief.glb" ../../public/models/chief.glb --compress meshopt --texture-compress webp --texture-size 2048 --simplify false --join false --flatten false
cp "$W/chief.clips.json" ../../public/models/chief.clips.json

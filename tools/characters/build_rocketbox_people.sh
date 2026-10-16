#!/usr/bin/env bash
# Builds the Rocketbox cast (MIT): each avatar as a small GLB with ARKit + viseme face shapes, and
# one shared animation library per sex that every avatar on the Biped skeleton plays.
# Add a person: append "Folder/Avatar_Name:out_name" to PEOPLE and an entry in src/three/people.ts.
# Needs PY (Python with the bpy wheel) and ROCKETBOX (a clone of microsoft/Microsoft-Rocketbox).
set -euo pipefail
cd "$(dirname "$0")"
W=${WORK:-/tmp/wahala-rocketbox}; mkdir -p "$W"
OUT=../../public/models
PEOPLE="Adults/Female_Party_02:player_f Adults/Male_Adult_04:diner_m1 Adults/Male_Adult_12:diner_m2 Professions/Business_Female_01:diner_f1 Professions/Business_Male_05:waiter"
mkdir -p $OUT/people $OUT/anims
for p in $PEOPLE; do
  src=${p%%:*}; name=${p##*:}; base=$(basename "$src")
  $PY rb_avatar.py "$ROCKETBOX/Assets/Avatars/$src/Export/${base}_facial.fbx" "$W/$name.glb"
  npx gltf-transform optimize "$W/$name.glb" "$OUT/people/$name.glb" --compress meshopt --texture-compress webp --texture-size 1024 --simplify false --join false --flatten false
done
# animation libraries, made on one avatar of each sex
for lib in female:player_f male:diner_m1; do
  k=${lib%%:*}; av=${lib##*:}
  sed "s|\$ROCKETBOX|$ROCKETBOX|g" rb_${k}_clips.template.json > "$W/$k.json"
  TARGET=rocketbox ANIM_ONLY=1 $PY retarget.py "$W/$av.blend" "$W/$k.json" "$W/rb_$k.glb"
  npx gltf-transform optimize "$W/rb_$k.glb" "$OUT/anims/rb_$k.glb" --compress meshopt --simplify false --join false --flatten false --prune false
  cp "$W/rb_$k.clips.json" "$OUT/anims/rb_$k.clips.json"
done

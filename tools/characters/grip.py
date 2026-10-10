# Finds where a held object sits in the hand during a clip: the grip point and the object's up axis,
# both in the hand bone's local space (what three.js needs to parent a glass/bag to the bone).
import bpy, sys, json
from mathutils import Vector
blend, clip, frame, out = sys.argv[-4], sys.argv[-3], int(sys.argv[-2]), sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
rig = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for t in rig.animation_data.nla_tracks: t.mute = True
a = bpy.data.actions[clip]; rig.animation_data.action = a
if a.slots: rig.animation_data.action_slot = a.slots[0]
bpy.context.scene.frame_set(frame)
P = lambda n: rig.matrix_world @ rig.pose.bones[n].head
head = P('head')
res = {}
for s in ('l', 'r'):
    hand = rig.pose.bones['hand_' + s]
    grip = (P(f'thumb_02_{s}') + P(f'index_01_{s}') + P(f'middle_01_{s}') + P(f'ring_01_{s}') + P(f'index_02_{s}')) / 5
    # push from the knuckle line toward the palm, opposite the back of the hand
    M = rig.matrix_world @ hand.matrix
    inv = M.inverted()
    local = inv @ grip
    up_local = (inv.to_3x3() @ Vector((0, 0, 1))).normalized()
    res[s] = {'bone': 'hand_' + s, 'grip': [round(x, 4) for x in local], 'up': [round(x, 4) for x in up_local],
              'dist_head': round((P('hand_' + s) - head).length, 3), 'world': [round(x, 3) for x in grip]}
print('GRIP', json.dumps(res))
json.dump(res, open(out, 'w'))

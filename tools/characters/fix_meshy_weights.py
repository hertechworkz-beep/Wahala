# Meshy's auto-rig lets the thigh/hip bones pull on the hands (the hands rest beside the thighs).
# Vertices that mainly belong to an arm or hand stop following the legs/hips; weights renormalised.
import bpy, sys
src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src)
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Icosphere')]:
    bpy.data.objects.remove(o, do_unlink=True)
me = [o for o in bpy.data.objects if o.type == 'MESH'][0]
G = {g.index: g.name for g in me.vertex_groups}
def side_of(name):
    return 'Right' if 'Right' in name else 'Left' if 'Left' in name else None
ARM = ('Shoulder', 'Arm', 'ForeArm', 'Hand')
LEGGY = ('UpLeg', 'Leg', 'Foot', 'Toe', 'Hips')
fixed = 0
for v in me.data.vertices:
    ws = [(g.group, g.weight) for g in v.groups]
    arm = {}
    for gi, w in ws:
        n = G[gi].replace('mixamorig:', '')
        if any(k in n for k in ARM) and 'UpLeg' not in n:
            arm[side_of(n)] = arm.get(side_of(n), 0) + w
    if not arm:
        continue
    side, aw = max(arm.items(), key=lambda kv: kv[1])
    if aw < 0.35:
        continue
    drop = [gi for gi, w in ws if any(k in G[gi] for k in LEGGY) and w > 0]
    if not drop:
        continue
    for gi in drop:
        me.vertex_groups[G[gi]].remove([v.index])
    tot = sum(g.weight for g in v.groups)
    if tot > 0:
        for g in v.groups:
            g.weight = g.weight / tot
    fixed += 1
print('FIXED', fixed)
bpy.ops.wm.save_as_mainfile(filepath=out)

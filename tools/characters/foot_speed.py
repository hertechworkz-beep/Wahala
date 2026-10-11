# Speed of an in-place locomotion loop = how fast the planted foot slides backwards.
import bpy, sys
bpy.ops.wm.open_mainfile(filepath=sys.argv[-1])
arm = bpy.data.objects['target_character']; sc = bpy.context.scene
for name in ('Walking', 'Running'):
    a = bpy.data.actions[name]; arm.animation_data.action = a
    if a.slots: arm.animation_data.action_slot = a.slots[0]
    f0, f1 = int(a.frame_range[0]), int(a.frame_range[1])
    vs = []
    for side in ('Left', 'Right'):
        prev = None; zs = []
        samples = []
        for f in range(f0, f1 + 1):
            sc.frame_set(f)
            p = arm.matrix_world @ arm.pose.bones[f'mixamorig:{side}Foot'].head
            samples.append(p.copy())
        zmin = min(p.z for p in samples)
        for p0, p1 in zip(samples, samples[1:]):
            if p0.z < zmin + 0.025 and p1.z < zmin + 0.025:
                vs.append(abs(p1.y - p0.y) * sc.render.fps)
    vs.sort()
    print('SPEED', name, round(sum(vs[len(vs)//4: 3*len(vs)//4]) / max(1, len(vs[len(vs)//4: 3*len(vs)//4])), 3), 'n', len(vs))

# Retargets Microsoft Rocketbox animations (3ds Max Biped skeleton, MIT) onto a MakeHuman
# game_engine rig, then exports the character as one .glb with all its clips.
#
# Per bone, per frame:  R_target = R_source(f) * R_source_rest^-1 * Q_align * R_target_rest
# where Q_align rotates the target's rest posture (A-pose) onto the source's rest posture
# (arms down), measured joint to joint. Hips are scaled by leg length. Loops are made in-place
# and their travel speed is recorded so the game can move the character without foot sliding.
import bpy, sys, os, json, math
from mathutils import Matrix, Quaternion, Vector

blend, clips_json, out_glb = sys.argv[-3], sys.argv[-2], sys.argv[-1]
CLIPS = json.load(open(clips_json))
bpy.ops.wm.open_mainfile(filepath=blend)
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Icosphere')]:
    bpy.data.objects.remove(o, do_unlink=True)
RIG = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
RIG.rotation_mode = 'XYZ'

TARGET = os.environ.get('TARGET', 'game_engine')
if TARGET == 'mixamo':
    P = 'mixamorig:'
    HIPS = P + 'Hips'
    MAP = {'Bip01 Pelvis': HIPS, 'Bip01 Spine': P + 'Spine', 'Bip01 Spine1': P + 'Spine1', 'Bip01 Spine2': P + 'Spine2',
           'Bip01 Neck': P + 'Neck', 'Bip01 Head': P + 'Head'}
    for s, side in (('L', 'Left'), ('R', 'Right')):
        MAP.update({f'Bip01 {s} Clavicle': f'{P}{side}Shoulder', f'Bip01 {s} UpperArm': f'{P}{side}Arm', f'Bip01 {s} Forearm': f'{P}{side}ForeArm',
                    f'Bip01 {s} Hand': f'{P}{side}Hand', f'Bip01 {s} Thigh': f'{P}{side}UpLeg', f'Bip01 {s} Calf': f'{P}{side}Leg',
                    f'Bip01 {s} Foot': f'{P}{side}Foot', f'Bip01 {s} Toe0': f'{P}{side}ToeBase'})
        if not os.environ.get('SKIP_FINGERS'):
            for fi, fname in enumerate(['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']):
                for k in range(3):
                    MAP[f'Bip01 {s} Finger{fi}' + ('' if k == 0 else str(k))] = f'{P}{side}Hand{fname}{k + 1}'
    CHAIN = {HIPS: P + 'Spine', P + 'Spine': P + 'Spine1', P + 'Spine1': P + 'Spine2', P + 'Spine2': P + 'Neck', P + 'Neck': P + 'Head'}
    for side in ('Left', 'Right'):
        CHAIN.update({f'{P}{side}Shoulder': f'{P}{side}Arm', f'{P}{side}Arm': f'{P}{side}ForeArm', f'{P}{side}ForeArm': f'{P}{side}Hand',
                      f'{P}{side}Hand': f'{P}{side}HandMiddle1', f'{P}{side}UpLeg': f'{P}{side}Leg', f'{P}{side}Leg': f'{P}{side}Foot',
                      f'{P}{side}Foot': f'{P}{side}ToeBase'})
        for f in ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']:
            CHAIN[f'{P}{side}Hand{f}1'] = f'{P}{side}Hand{f}2'
            CHAIN[f'{P}{side}Hand{f}2'] = f'{P}{side}Hand{f}3'
    def child_joint(tname):
        return CHAIN.get(tname)
elif TARGET == 'rocketbox':
    # Same Biped skeleton as the source: map every bone to itself (fingers included).
    HIPS = 'Bip01 Pelvis'
    MAP = {b.name: b.name for b in RIG.data.bones if b.name.startswith('Bip01 ') and not b.name.endswith('Nub') and 'Footsteps' not in b.name}
    def child_joint(tname):
        kids = [c.name for c in RIG.data.bones[tname].children if c.name in MAP]
        spine = [k for k in kids if 'Spine' in k or 'Neck' in k or 'Head' in k]
        mid = [k for k in kids if 'Finger2' in k or k.endswith(('Forearm', 'Hand', 'Calf', 'Foot', 'Toe0', 'UpperArm'))]
        pick = spine or mid or kids
        return pick[0] if pick else None
else:
    HIPS = 'pelvis'
    MAP = {'Bip01 Pelvis': 'pelvis', 'Bip01 Spine': 'spine_01', 'Bip01 Spine1': 'spine_02', 'Bip01 Spine2': 'spine_03',
           'Bip01 Neck': 'neck_01', 'Bip01 Head': 'head'}
    for s, t in (('L', 'l'), ('R', 'r')):
        MAP.update({f'Bip01 {s} Clavicle': f'clavicle_{t}', f'Bip01 {s} UpperArm': f'upperarm_{t}', f'Bip01 {s} Forearm': f'lowerarm_{t}',
                    f'Bip01 {s} Hand': f'hand_{t}', f'Bip01 {s} Thigh': f'thigh_{t}', f'Bip01 {s} Calf': f'calf_{t}',
                    f'Bip01 {s} Foot': f'foot_{t}', f'Bip01 {s} Toe0': f'ball_{t}'})
        for fi, fname in enumerate(['thumb', 'index', 'middle', 'ring', 'pinky']):
            for k in range(3):
                src = f'Bip01 {s} Finger{fi}' + ('' if k == 0 else str(k))
                MAP[src] = f'{fname}_0{k + 1}_{t}'
    def child_joint(tname):
        order = {'pelvis': 'spine_01', 'spine_01': 'spine_02', 'spine_02': 'spine_03', 'spine_03': 'neck_01', 'neck_01': 'head'}
        if tname in order:
            return order[tname]
        for t in ('l', 'r'):
            chain = {f'clavicle_{t}': f'upperarm_{t}', f'upperarm_{t}': f'lowerarm_{t}', f'lowerarm_{t}': f'hand_{t}', f'hand_{t}': f'middle_01_{t}',
                     f'thigh_{t}': f'calf_{t}', f'calf_{t}': f'foot_{t}', f'foot_{t}': f'ball_{t}'}
            if tname in chain:
                return chain[tname]
            for f in ['thumb', 'index', 'middle', 'ring', 'pinky']:
                if tname == f'{f}_01_{t}': return f'{f}_02_{t}'
                if tname == f'{f}_02_{t}': return f'{f}_03_{t}'
        return None
INV = {v: k for k, v in MAP.items()}

def rot3(m):
    return m.to_3x3().normalized().to_quaternion()

TB = RIG.data.bones
T_REST_W = {b.name: rot3(RIG.matrix_world @ b.matrix_local) for b in TB}
T_HEAD_W = {b.name: RIG.matrix_world @ b.head_local for b in TB}

def import_clip(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    new = [o for o in bpy.data.objects if o not in before]
    arm = [o for o in new if o.type == 'ARMATURE'][0]
    return arm, new

out_meta = {}
sc = bpy.context.scene
# Clips that came with the model (e.g. Meshy's walk/run) are kept, renamed, as NLA tracks.
if RIG.animation_data:
    for tr in list(RIG.animation_data.nla_tracks):
        RIG.animation_data.nla_tracks.remove(tr)
for spec in filter(None, os.environ.get('KEEP', '').split(',')):
    src_name, new_name, speed = (spec.split(':') + ['0'])[:3]
    a = bpy.data.actions.get(src_name)
    if not a:
        continue
    a.name = new_name
    a.use_fake_user = True
    RIG.animation_data_create()
    tr = RIG.animation_data.nla_tracks.new(); tr.name = new_name
    tr.strips.new(new_name, int(a.frame_range[0]), a)
    fps = sc.render.fps
    out_meta[new_name] = {'frames': int(a.frame_range[1] - a.frame_range[0]) + 1, 'duration': round((a.frame_range[1] - a.frame_range[0]) / fps, 3),
                          'speed': float(speed), 'loop': True, 'root': 'inplace', 'end_offset': [0, 0, 0]}
if RIG.animation_data:
    RIG.animation_data.action = None
FPS = sc.render.fps
for clip in CLIPS:
    S, new_objs = import_clip(clip['file'])
    sc.render.fps, sc.render.fps_base = FPS, 1.0  # the FBX importer may change it
    act_src = S.animation_data.action
    f0, f1 = int(act_src.frame_range[0]), int(act_src.frame_range[1])
    SB = S.data.bones
    S_REST_W = {b.name: rot3(S.matrix_world @ b.matrix_local) for b in SB}
    S_HEAD_W = {b.name: S.matrix_world @ b.head_local for b in SB}
    # posture alignment per target bone
    Q_ALIGN = {}
    for sname, tname in MAP.items():
        if sname not in SB or tname not in TB:
            continue
        cj = child_joint(tname)
        if cj and cj in INV and INV[cj] in SB:
            td = (T_HEAD_W[cj] - T_HEAD_W[tname]).normalized()
            sd = (S_HEAD_W[INV[cj]] - S_HEAD_W[sname]).normalized()
            Q_ALIGN[tname] = td.rotation_difference(sd)
    # bones without a child joint inherit their parent's alignment
    for sname, tname in MAP.items():
        if tname in TB and tname not in Q_ALIGN:
            p = TB[tname].parent
            while p is not None and p.name not in Q_ALIGN:
                p = p.parent
            Q_ALIGN[tname] = Q_ALIGN[p.name] if p is not None else Quaternion()
    s_pelvis_rest = S_HEAD_W['Bip01 Pelvis']
    ratio = T_HEAD_W[HIPS].z / s_pelvis_rest.z
    # sample the source
    frames = list(range(f0, f1 + 1))
    samples = []
    for f in frames:
        sc.frame_set(f)
        rots = {}
        for sname, tname in MAP.items():
            if sname in S.pose.bones and tname in TB:
                rots[tname] = rot3(S.matrix_world @ S.pose.bones[sname].matrix)
        ppos = S.matrix_world @ S.pose.bones['Bip01 Pelvis'].head
        samples.append((rots, ppos))
    # root motion
    start, end = samples[0][1], samples[-1][1]
    travel = Vector((end.x - start.x, end.y - start.y, 0))
    mode = clip.get('root', 'inplace')
    dur = (len(frames) - 1) / 30.0
    speed = travel.length * ratio / dur if dur > 0 else 0.0
    # build the action
    act = bpy.data.actions.new(clip['name'])
    RIG.animation_data_create()
    RIG.animation_data.action = act
    for pb in RIG.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    rig_inv = RIG.matrix_world.inverted()
    order = [b.name for b in TB]  # parents before children
    for fi, (rots, ppos) in enumerate(samples):
        k = fi / max(1, len(samples) - 1)
        dp = ppos - s_pelvis_rest
        if mode == 'inplace':
            dp = dp - travel * k - Vector((start.x - s_pelvis_rest.x, start.y - s_pelvis_rest.y, 0))
        elif mode == 'static':
            dp = Vector((0, 0, dp.z))
        pel_w = T_HEAD_W[HIPS] + dp * ratio
        arm_mats = {}
        for name in order:
            b = TB[name]
            pb = RIG.pose.bones[name]
            if name in rots:
                sname = INV[name]
                rw = rots[name] @ S_REST_W[sname].inverted() @ Q_ALIGN[name] @ T_REST_W[name]
                rot_arm = rot3(rig_inv) @ rw
            else:
                rot_arm = None
            if b.parent is None:
                parent_arm = Matrix.Identity(4)
                rel = b.matrix_local
            else:
                parent_arm = arm_mats[b.parent.name]
                rel = b.parent.matrix_local.inverted() @ b.matrix_local
            default = parent_arm @ rel
            if name == HIPS:
                loc = rig_inv @ pel_w
            else:
                loc = default.to_translation()
            if rot_arm is None:
                rot_arm = rot3(default)
            M = Matrix.LocRotScale(loc, rot_arm, Vector((1, 1, 1)))
            arm_mats[name] = M
            basis = (parent_arm @ rel).inverted() @ M
            pb.rotation_quaternion = basis.to_quaternion()
            pb.keyframe_insert('rotation_quaternion', frame=1 + fi * FPS / 30.0, group=name)
            if name == HIPS:
                pb.location = basis.to_translation()
                pb.keyframe_insert('location', frame=1 + fi * FPS / 30.0, group=name)
    act.use_fake_user = True
    try:
        track = RIG.animation_data.nla_tracks.new()
        track.name = clip['name']
        track.strips.new(clip['name'], 1, act)
    except Exception as e:
        print('NLA', e)
    RIG.animation_data.action = None
    out_meta[clip['name']] = {'frames': len(frames), 'duration': round(dur, 3), 'speed': round(speed, 3), 'loop': clip.get('loop', False), 'root': mode,
                              'end_offset': [round(v * ratio, 3) for v in (travel if mode == 'keep' else Vector((0, 0, 0)))]}
    for o in new_objs:
        bpy.data.objects.remove(o, do_unlink=True)
    print('CLIP', clip['name'], out_meta[clip['name']])

# reset to rest for export
for pb in RIG.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
bpy.ops.wm.save_as_mainfile(filepath=out_glb.replace('.glb', '_anim.blend'))
if os.environ.get('ANIM_ONLY'):
    # a shared clip library: just the skeleton and its clips, no body
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        bpy.data.objects.remove(o, do_unlink=True)
json.dump(out_meta, open(out_glb.replace('.glb', '.clips.json'), 'w'), indent=1)
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', export_animation_mode='NLA_TRACKS', export_skins=True, export_morph=True,
                          export_apply=False, export_yup=True, export_image_format='WEBP', export_image_quality=82, export_cameras=False, export_lights=False)
print('EXPORTED', out_glb, os.path.getsize(out_glb))

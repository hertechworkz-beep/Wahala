# Chief Emeka, step 2: skin, beard, hair, cap, coral beads, senator outfit, shoes, jewellery.
import sys, os, math, bpy, bmesh, random
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dresslib import *

src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src)
clean_scene()
H = bpy.data.objects['Human']
RIG = bpy.data.objects['Human.rig']
EYES = bpy.data.objects['Human.low-poly']
for m in list(EYES.modifiers):
    if m.type == 'SUBSURF':
        EYES.modifiers.remove(m)
mw = H.matrix_world
B = {b.name: (RIG.matrix_world @ b.head_local, RIG.matrix_world @ b.tail_local) for b in RIG.data.bones}
W = bone_weights(H)
V = [mw @ v.co for v in H.data.vertices]

lips = group_verts(H, 'lips')
LIPS = centroid(H, lips)
lip_set = set(lips)
eyev = [EYES.matrix_world @ v.co for v in EYES.data.vertices]
EYE_L = sum([p for p in eyev if p.x > 0], Vector()) / max(1, len([p for p in eyev if p.x > 0]))
EYE_R = sum([p for p in eyev if p.x < 0], Vector()) / max(1, len([p for p in eyev if p.x < 0]))
EYE_Z = (EYE_L.z + EYE_R.z) / 2
print('LANDMARKS lips', tuple(round(x, 3) for x in LIPS), 'eyes', round(EYE_Z, 3), round(EYE_L.x, 3))

def beard_w(p):
    """0..1 how much this point is beard (full, groomed, salt-and-pepper)."""
    d = p - LIPS
    if p.y > LIPS.y + 0.09:   # behind the jaw
        return 0.0
    ax = abs(d.x)
    if ax > 0.088 or d.z < -0.1:
        return 0.0
    # mustache over the lip, a jawline beard that climbs to short sideburns near the ears
    if ax < 0.03:
        top = 0.03
    elif ax < 0.062:
        top = 0.012 + (ax - 0.03) * 0.5
    else:
        top = 0.06 if p.y > LIPS.y + 0.05 else 0.028
    if d.z > top:
        return 0.0
    if ax > 0.036 and d.z > 0.0 and p.y < LIPS.y + 0.04:
        return 0.0  # keep the front of the cheeks clear
    if ax < 0.024 and -0.013 < d.z < 0.013 and d.y > -0.025:
        return 0.0  # the mouth itself
    return 1.0

# ---------------------------------------------------------------- skin
col = H.data.color_attributes.new('skin', 'FLOAT_COLOR', 'POINT')
BASE = np.array([0.105, 0.048, 0.026])
for i, p in enumerate(V):
    c = BASE.copy()
    w = W[i]
    if i in lip_set:
        c = np.array([0.075, 0.028, 0.022])
    bw = beard_w(p)
    c = c * (1 - 0.35 * bw)
    # Under-eye darkness and a little warmth on the cheeks and forehead.
    for e in (EYE_L, EYE_R):
        de = (p - e)
        if abs(de.x) < 0.03 and -0.03 < de.z < -0.008 and de.y < 0.02:
            c = c * 0.85
    if p.z > EYE_Z + 0.02 and p.y < LIPS.y + 0.05 and p.z < EYE_Z + 0.08:
        c = c * 1.06
    col.data[i].color = (*c, 1.0)
skin_proc = bpy.data.materials.new('skin_proc')
skin_proc.use_nodes = True
nt = skin_proc.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'skin'
noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 300; noise.inputs['Detail'].default_value = 4
coord = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])
mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 0.18
nt.links.new(ca.outputs['Color'], mix.inputs['A'])
ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.93, 0.92, 0.92, 1); ramp.color_ramp.elements[1].color = (1.05, 1.04, 1.03, 1)
nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], mix.inputs['B'])
em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(mix.outputs['Result'], em.inputs['Color'])
o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs['Emission'], o.inputs['Surface'])
H.data.materials.clear(); H.data.materials.append(skin_proc)
skin_img = bake_to_image(H, skin_proc, int(os.environ.get('SKIN_RES', '2048')), 'chief_skin')
# Age: forehead lines, nasolabial folds and under-eye bags as a baked normal map.
bm_mat = bpy.data.materials.new('skin_bump'); bm_mat.use_nodes = True; nt = bm_mat.node_tree
P = nt.nodes['Principled BSDF']
co = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(co.outputs['Object'], sep.inputs['Vector'])
def M(op, a, b=None, val=None):
    n = nt.nodes.new('ShaderNodeMath'); n.operation = op
    for k, x in enumerate([a, b]):
        if x is None: continue
        if isinstance(x, (int, float)): n.inputs[k].default_value = x
        else: nt.links.new(x, n.inputs[k])
    return n.outputs[0]
X, Y, Z = sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']
front = M('LESS_THAN', Y, LIPS.y + 0.05)
fmask = M('MULTIPLY', M('MULTIPLY', M('GREATER_THAN', Z, EYE_Z + 0.03), M('LESS_THAN', Z, EYE_Z + 0.075)), front)
flines = M('POWER', M('ABSOLUTE', M('SINE', M('MULTIPLY', Z, 2 * math.pi / 0.012))), 6.0)
forehead = M('MULTIPLY', fmask, M('MULTIPLY', flines, M('LESS_THAN', M('ABSOLUTE', X), 0.05)))
def groove(x0, z0, x1, z1, width):
    # distance from (|x|, z) to a segment, as a soft groove
    ax = M('ABSOLUTE', X)
    dx, dz = x1 - x0, z1 - z0
    L2 = dx * dx + dz * dz
    t_ = M('MINIMUM', M('MAXIMUM', M('DIVIDE', M('ADD', M('MULTIPLY', M('SUBTRACT', ax, x0), dx), M('MULTIPLY', M('SUBTRACT', Z, z0), dz)), L2), 0.0), 1.0)
    px = M('ADD', M('MULTIPLY', t_, dx), x0); pz = M('ADD', M('MULTIPLY', t_, dz), z0)
    d = M('SQRT', M('ADD', M('POWER', M('SUBTRACT', ax, px), 2.0), M('POWER', M('SUBTRACT', Z, pz), 2.0)))
    return M('MULTIPLY', M('EXPONENT', M('MULTIPLY', M('POWER', M('DIVIDE', d, width), 2.0), -1.0)), front)
naso = groove(0.02, LIPS.z + 0.032, 0.036, LIPS.z - 0.012, 0.0035)
bags = M('ADD', groove(abs(EYE_L.x) - 0.016, EYE_Z - 0.016, abs(EYE_L.x) + 0.012, EYE_Z - 0.019, 0.003), groove(abs(EYE_L.x) - 0.012, EYE_Z - 0.024, abs(EYE_L.x) + 0.01, EYE_Z - 0.026, 0.003))
height = M('ADD', M('ADD', M('MULTIPLY', forehead, -0.7), M('MULTIPLY', naso, -1.0)), M('MULTIPLY', bags, -0.6))
pores = nt.nodes.new('ShaderNodeTexNoise'); pores.inputs['Scale'].default_value = 2200; nt.links.new(co.outputs['Object'], pores.inputs['Vector'])
height = M('ADD', height, M('MULTIPLY', pores.outputs['Fac'], 0.05))
bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 1.0; bump.inputs['Distance'].default_value = 0.003
nt.links.new(height, bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], P.inputs['Normal'])
H.data.materials.clear(); H.data.materials.append(bm_mat)
nrm_img = bake_to_image(H, bm_mat, int(os.environ.get('SKIN_RES', '2048')), 'chief_skin_normal', kind='NORMAL')
skin = new_material('chief_skin', image=skin_img, rough=0.52, normal_image=nrm_img)
skin.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = 0.35 if 'Specular IOR Level' in skin.node_tree.nodes['Principled BSDF'].inputs else 0
H.data.materials.clear(); H.data.materials.append(skin)
eye_img = bpy.data.images.load(os.path.join(os.environ['MH_DATA'], 'eyes/materials/brown_eye.png'))
px = np.array(eye_img.pixels[:]).reshape(-1, 4)
sat = px[:, 0] - np.minimum(px[:, 1], px[:, 2])
iris = sat > 0.12
px[iris, 0] = px[iris, 0] * 0.42; px[iris, 1] = px[iris, 1] * 0.55 + 0.02; px[iris, 2] = px[iris, 2] * 0.5 + 0.01
eye_img.pixels.foreach_set(px.astype(np.float32).ravel()); eye_img.pack()
EYES.data.materials.clear(); EYES.data.materials.append(new_material('chief_eyes', image=eye_img, rough=0.15))

# ---------------------------------------------------------------- beard, eyebrows, side hair (shells)
beard_mats = [
    new_material('chief_beard_in', image=strand_texture('beard_in', size=512, base=(0.07, 0.065, 0.06), grey=0.5, density=12000, length=(5, 10), seed=3, under=0.9), rough=0.75, alpha_clip=0.4),
    new_material('chief_beard_mid', image=strand_texture('beard_mid', size=512, grey=0.6, density=9000, length=(6, 13), seed=4), rough=0.75, alpha_clip=0.4),
    new_material('chief_beard_out', image=strand_texture('beard_out', size=512, grey=0.7, density=5000, length=(6, 13), seed=5), rough=0.75, alpha_clip=0.4),
]
beard_faces = faces_where(H, lambda c, p: beard_w(c) > 0)
shell(H, beard_faces, 'chief_beard', [0.0018, 0.0045, 0.007], beard_mats, uv_repeat=3)

def brow(c, p):
    for e in (EYE_L, EYE_R):
        d = c - e
        if abs(d.x) < 0.026 and 0.016 + 0.004 * abs(d.x) / 0.026 < d.z < 0.026 - 0.003 * abs(d.x) / 0.026 and d.y < 0.02:
            return True
    return False
brow_tex = strand_texture('brow_strands', size=256, base=(0.03, 0.025, 0.022), grey=0.3, density=2600, length=(6, 12), seed=5, angle_jitter=0.6)
shell(H, faces_where(H, brow), 'chief_brows', [0.0015, 0.003], new_material('chief_brows', image=brow_tex, rough=0.7, alpha_clip=0.4), uv_repeat=2)

# ---------------------------------------------------------------- cap (fila), parented to the head bone
head_c = (B['head'][0] + B['head'][1]) / 2
scalp = [V[i] for i in group_verts(H, 'scalp')]
CAP_FRONT = EYE_Z + 0.052
CAP_BACK = EYE_Z + 0.012
def cap_z(theta):  # theta 0 = front (-Y)
    f = (math.cos(theta) + 1) / 2
    return CAP_BACK + (CAP_FRONT - CAP_BACK) * f
head_pts = [p for p in V if p.z > EYE_Z - 0.03]
bm = bmesh.new()
N = 40
rings = []
for k, (dz, scale) in enumerate([(0.0, 1.0), (0.004, 1.03), (0.05, 1.05), (0.088, 1.06), (0.095, 1.035)]):
    ring = []
    for j in range(N):
        th = j / N * 2 * math.pi
        dirv = Vector((math.sin(th), -math.cos(th), 0))
        z0 = cap_z(th)
        near = [p for p in head_pts if abs(p.z - z0) < 0.012]
        cx, cy = head_c.x, head_c.y
        r = max([((p.x - cx) * dirv.x + (p.y - cy) * dirv.y) for p in near] or [0.09]) + 0.004
        ring.append(bm.verts.new((cx + dirv.x * r * scale, cy + dirv.y * r * scale, z0 + dz + (0.0 if k < 2 else 0.0))))
    rings.append(ring)
for a, b in zip(rings, rings[1:]):
    for j in range(N):
        bm.faces.new([a[j], a[(j + 1) % N], b[(j + 1) % N], b[j]])
bm.faces.new(list(reversed(rings[-1])))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
cap_me = bpy.data.meshes.new('chief_cap'); bm.to_mesh(cap_me); bm.free()
cap = bpy.data.objects.new('chief_cap', cap_me); bpy.context.collection.objects.link(cap)
for f in cap_me.polygons:
    f.use_smooth = True
cap_me.materials.append(new_material('chief_cap', color=(0.17, 0.004, 0.007, 1), rough=0.85))
parent_to_bone(cap, RIG, 'head')
# Short grey-black hair below the cap line.
hair_tex = strand_texture('hair_strands', size=256, base=(0.07, 0.065, 0.06), grey=0.55, density=6000, length=(3, 7), seed=7, angle_jitter=0.8, under=0.85)
def side_hair(c, p):
    if c.z < EYE_Z - 0.005 or c.z > cap_z(math.atan2(c.x - head_c.x, -(c.y - head_c.y))) + 0.004:
        return False
    if c.y < EYE_L.y + 0.035:   # not on the face
        return False
    ears = abs(c.x) > 0.075 and abs(c.z - EYE_Z) < 0.03 and abs(c.y - head_c.y) < 0.03
    return not ears and beard_w(c) == 0
shell(H, faces_where(H, side_hair), 'chief_hair', [0.003, 0.006], new_material('chief_hair', image=hair_tex, rough=0.75, alpha_clip=0.35), uv_repeat=4)

# ---------------------------------------------------------------- clothes: senator top to the knee, trousers
TORSO = {'pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'}
ARMS = {'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r'}
LEGS = {'thigh_l', 'thigh_r', 'calf_l', 'calf_r'}
ALL = TORSO | ARMS | LEGS | {'neck_01', 'head', 'hand_l', 'hand_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r'}
NECK_BASE = B['neck_01'][0].z + 0.012
ANKLE = B['foot_l'][0].z + 0.055
def face_dom(p):
    acc = {}
    for vi in p.vertices:
        for k, w in W[vi].items():
            if k in ALL:
                acc[k] = acc.get(k, 0) + w
    return max(acc, key=acc.get) if acc else None
def wrist_dist(c):
    return min((c - B['hand_l'][0]).length, (c - B['hand_r'][0]).length)
top_faces, leg_faces, foot_faces = [], [], []
for p in H.data.polygons:
    c = mw @ p.center
    d = face_dom(p)
    if d in TORSO or (d == 'neck_01' and c.z < NECK_BASE):
        top_faces.append(p.index)
    elif d in ARMS and wrist_dist(c) > 0.035:
        top_faces.append(p.index)
    elif d in LEGS and c.z > ANKLE:
        leg_faces.append(p.index)
    elif d in {'foot_l', 'foot_r', 'ball_l', 'ball_r'} or (d in LEGS and c.z <= ANKLE):
        foot_faces.append(p.index)

def strip_shapekeys(o):
    if o.data.shape_keys:
        o.shape_key_clear()

def bake_fabric(o, name, size=1024, hem_z=None):
    """Red cloth with a woven motif and gold embroidery bands, baked from object space."""
    m = bpy.data.materials.new(name + '_proc'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    co = nt.nodes.new('ShaderNodeTexCoord')
    vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 34
    nt.links.new(co.outputs['Object'], vor.inputs['Vector'])
    noi = nt.nodes.new('ShaderNodeTexNoise'); noi.inputs['Scale'].default_value = 260; nt.links.new(co.outputs['Object'], noi.inputs['Vector'])
    # motif: small gold dots at cell centres, darker red rings around them
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.0; mr.inputs['From Max'].default_value = 0.035
    mr.inputs['To Min'].default_value = 1.0; mr.inputs['To Max'].default_value = 0.0
    nt.links.new(vor.outputs['Distance'], mr.inputs['Value'])
    ring = nt.nodes.new('ShaderNodeMapRange'); ring.inputs['From Min'].default_value = 0.12; ring.inputs['From Max'].default_value = 0.2
    ring.inputs['To Min'].default_value = 0.0; ring.inputs['To Max'].default_value = 1.0
    nt.links.new(vor.outputs['Distance'], ring.inputs['Value'])
    red = (0.15, 0.004, 0.009, 1); dark = (0.115, 0.003, 0.007, 1); gold = (0.48, 0.27, 0.035, 1)
    m1 = nt.nodes.new('ShaderNodeMix'); m1.data_type = 'RGBA'
    m1.inputs['A'].default_value = dark; m1.inputs['B'].default_value = red
    nt.links.new(ring.outputs['Result'], m1.inputs['Factor'])
    m2 = nt.nodes.new('ShaderNodeMix'); m2.data_type = 'RGBA'; m2.inputs['B'].default_value = gold
    nt.links.new(m1.outputs['Result'], m2.inputs['A']); nt.links.new(mr.outputs['Result'], m2.inputs['Factor'])
    # gold embroidery bands, computed per pixel from object position so the edges are crisp
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(co.outputs['Object'], sep.inputs['Vector'])
    def Mt(op, a, b=None):
        n = nt.nodes.new('ShaderNodeMath'); n.operation = op
        for k, x in enumerate([a, b]):
            if x is None: continue
            if isinstance(x, (int, float)): n.inputs[k].default_value = x
            else: nt.links.new(x, n.inputs[k])
        return n.outputs[0]
    Xo, Yo, Zo = sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']
    neck = Mt('GREATER_THAN', Zo, NECK_BASE - 0.022)
    placket = Mt('MULTIPLY', Mt('MULTIPLY', Mt('LESS_THAN', Mt('ABSOLUTE', Xo), 0.016), Mt('LESS_THAN', Yo, 0.0)), Mt('MULTIPLY', Mt('GREATER_THAN', Zo, NECK_BASE - 0.24), Mt('LESS_THAN', Zo, NECK_BASE)))
    def wrist(bone):
        vm = nt.nodes.new('ShaderNodeVectorMath'); vm.operation = 'DISTANCE'
        nt.links.new(co.outputs['Object'], vm.inputs[0]); vm.inputs[1].default_value = B[bone][0]
        return Mt('LESS_THAN', vm.outputs['Value'], 0.07)
    cuffs = Mt('MAXIMUM', wrist('hand_l'), wrist('hand_r'))
    band = Mt('MAXIMUM', Mt('MAXIMUM', neck, placket), cuffs)
    if hem_z is not None:
        band = Mt('MAXIMUM', band, Mt('LESS_THAN', Zo, hem_z + 0.04))
    m3 = nt.nodes.new('ShaderNodeMix'); m3.data_type = 'RGBA'; m3.inputs['B'].default_value = (0.42, 0.24, 0.045, 1)
    nt.links.new(m2.outputs['Result'], m3.inputs['A']); nt.links.new(band, m3.inputs['Factor'])
    # thread texture
    m4 = nt.nodes.new('ShaderNodeMix'); m4.data_type = 'RGBA'; m4.blend_type = 'MULTIPLY'; m4.inputs['Factor'].default_value = 0.25
    nt.links.new(m3.outputs['Result'], m4.inputs['A']); nt.links.new(noi.outputs['Color'], m4.inputs['B'])
    em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(m4.outputs['Result'], em.inputs['Color'])
    out_ = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs['Emission'], out_.inputs['Surface'])
    o.data.materials.clear(); o.data.materials.append(m)
    img = bake_to_image(o, m, size, name)
    o.data.materials.clear(); o.data.materials.append(new_material(name, image=img, rough=0.62, sheen=0.4))

top = shell(H, top_faces, 'chief_top', [0.016], bpy.data.materials.new('tmp'))[0]
trousers = shell(H, leg_faces, 'chief_trousers', [0.014], bpy.data.materials.new('tmp2'))[0]
shoes = shell(H, foot_faces, 'chief_shoes', [0.006], new_material('chief_shoes', color=(0.012, 0.010, 0.010, 1), rough=0.28))[0]
for o in (top, trousers):
    strip_shapekeys(o)
    smooth_mesh(o, 12, 0.5)
    for v in o.data.vertices:
        v.co = v.co + v.normal * 0.004
# Shoes: a closed leather shape per foot (convex hull of the foot, smoothed), riding on the foot bones.
bpy.data.objects.remove(shoes, do_unlink=True)
for side in ('l', 'r'):
    fv = [V[i] for i in range(len(V)) if dominant(W[i], {'foot_' + side, 'ball_' + side, 'calf_' + side})[0] in {'foot_' + side, 'ball_' + side} and V[i].z < ANKLE + 0.01 and (V[i].x > 0.03 if side == 'l' else V[i].x < -0.03)]
    bm = bmesh.new()
    for p in fv:
        bm.verts.new(p)
    bmesh.ops.convex_hull(bm, input=bm.verts)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=1, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    me = bpy.data.meshes.new('chief_shoe_' + side); bm.to_mesh(me); bm.free()
    so = bpy.data.objects.new('chief_shoe_' + side, me); bpy.context.collection.objects.link(so)
    smooth_mesh(so, 6, 0.4)
    for v in me.vertices:
        v.co = v.co + v.normal * 0.005
    for f in me.polygons:
        f.use_smooth = True
    me.materials.append(new_material('chief_shoes', color=(0.012, 0.010, 0.010, 1), rough=0.28))
    skin_from_body(so, H, RIG)

# Tunic skirt: from the waist to just below the knee, wide enough to drape over the belly and both legs.
KNEE = B['calf_l'][0].z
z_top, z_hem = B['pelvis'][0].z + 0.08, KNEE - 0.2
body_pts = [V[i] for i in range(len(V)) if W[i] and dominant(W[i], TORSO | LEGS)[0]]
bm = bmesh.new()
Nr, rings = 44, []
zs = np.linspace(z_top, z_hem, 16)
for zi, z in enumerate(zs):
    sl = [p for p in body_pts if abs(p.z - z) < 0.02]
    cy = sum(p.y for p in sl) / len(sl)
    ring = []
    for j in range(Nr):
        th = j / Nr * 2 * math.pi
        dv = Vector((math.sin(th), -math.cos(th), 0))
        r = max([(p.x * dv.x + (p.y - cy) * dv.y) for p in sl]) + 0.016 + 0.02 * (zi / (len(zs) - 1))
        v = bm.verts.new((dv.x * r, cy + dv.y * r, z))
        ring.append(v)
    rings.append(ring)
for a, b in zip(rings, rings[1:]):
    for j in range(Nr):
        bm.faces.new([a[j], b[j], b[(j + 1) % Nr], a[(j + 1) % Nr]])
uv = bm.loops.layers.uv.new('UVMap')
for f in bm.faces:
    for l in f.loops:
        v = l.vert.co
        th = math.atan2(v.x, -(v.y))
        l[uv].uv = ((th / (2 * math.pi)) % 1.0, (v.z - z_hem) / (z_top - z_hem))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
sk_me = bpy.data.meshes.new('chief_skirt'); bm.to_mesh(sk_me); bm.free()
skirt = bpy.data.objects.new('chief_skirt', sk_me); bpy.context.collection.objects.link(skirt)
for f in sk_me.polygons:
    f.use_smooth = True
# Skirt weights: pelvis at the waist, blending into each thigh by side, so the hem swings with the legs.
for n in ('pelvis', 'thigh_l', 'thigh_r'):
    skirt.vertex_groups.new(name=n)
SKIRT_CY = sum(v.co.y for v in sk_me.vertices) / len(sk_me.vertices)
for v in sk_me.vertices:
    t = (v.co.z - z_hem) / (z_top - z_hem)
    wp = min(1.0, max(0.0, t)) ** 0.8
    side = 1 / (1 + math.exp(-v.co.x / 0.03))  # 0 = right (−x), 1 = left (+x)
    front = 1 / (1 + math.exp((v.co.y - SKIRT_CY) / 0.025))  # 1 at the front (−y): lies over the lap when seated
    centre = math.exp(-(v.co.x / 0.07) ** 2)
    legs = (1 - wp) * (0.12 + 0.88 * front) * (1 - 0.65 * centre)
    skirt.vertex_groups['pelvis'].add([v.index], 1 - legs, 'REPLACE')
    skirt.vertex_groups['thigh_l'].add([v.index], legs * side, 'REPLACE')
    skirt.vertex_groups['thigh_r'].add([v.index], legs * (1 - side), 'REPLACE')
skirt.parent = RIG
am = skirt.modifiers.new('Armature', 'ARMATURE'); am.object = RIG

bake_fabric(top, 'chief_top_fabric', 1024)
bake_fabric(trousers, 'chief_trousers_fabric', 512)
bake_fabric(skirt, 'chief_skirt_fabric', 1024, hem_z=z_hem)

# Hide the body under the clothes (saves triangles, stops skin poking through).
delete_faces(H, set(top_faces) | set(leg_faces) | set(foot_faces))

# ---------------------------------------------------------------- coral beads on the chest (rigid on spine_03)
bvh_src = []
for o in (top,):
    me = o.data
    bvh_src.append(BVHTree.FromPolygons([o.matrix_world @ v.co for v in me.vertices], [p.vertices[:] for p in me.polygons]))
bvh = bvh_src[0]
neck_c = B['neck_01'][0]
beads = bmesh.new()
rng = random.Random(4)
for (z0, dip, r, rx) in [(NECK_BASE - 0.005, 0.07, 0.0095, 0.072), (NECK_BASE - 0.012, 0.13, 0.0105, 0.082), (NECK_BASE - 0.02, 0.2, 0.009, 0.092)]:
    pts = []
    for j in range(400):
        t = j / 400 * 2 * math.pi
        x = math.sin(t) * rx
        y = neck_c.y - math.cos(t) * rx * 0.9
        z = z0 - dip * max(0.0, math.cos(t)) ** 2
        pts.append(Vector((x, y, z)))
    # walk the path dropping beads every ~2r
    acc, last = 0, None
    for p in pts:
        if last is not None:
            acc += (p - last).length
        last = p
        if acc < 2.05 * r and acc != 0:
            continue
        acc = 0
        loc, nrm, _, _ = bvh.find_nearest(p)
        if loc is None:
            continue
        c = loc + nrm * (r * 0.95)
        rr = r * rng.uniform(0.9, 1.1)
        bmesh.ops.create_uvsphere(beads, u_segments=8, v_segments=6, radius=rr, matrix=Matrix.Translation(c))
bead_me = bpy.data.meshes.new('chief_beads'); beads.to_mesh(bead_me); beads.free()
for f in bead_me.polygons:
    f.use_smooth = True
bo = bpy.data.objects.new('chief_beads', bead_me); bpy.context.collection.objects.link(bo)
bead_me.materials.append(new_material('chief_coral', color=(0.62, 0.075, 0.03, 1), rough=0.3))
parent_to_bone(bo, RIG, 'spine_03')

# ---------------------------------------------------------------- gold watch (left wrist) and ring (right hand)
def torus_on(bone, along, radius, minor, t, name):
    h, tl = B[bone]
    axis = (tl - h).normalized()
    c = h + (tl - h) * t
    bm = bmesh.new()
    seg, mseg = 20, 6
    vs = []
    for i in range(seg):
        a = i / seg * 2 * math.pi
        for k in range(mseg):
            b = k / mseg * 2 * math.pi
            vs.append(Vector(((radius + minor * math.cos(b)) * math.cos(a), (radius + minor * math.cos(b)) * math.sin(a), minor * math.sin(b))))
    q = Vector((0, 0, 1)).rotation_difference(axis)
    bv = [bm.verts.new(c + q @ v) for v in vs]
    for i in range(seg):
        for k in range(mseg):
            a0, a1 = i * mseg + k, i * mseg + (k + 1) % mseg
            b0, b1 = ((i + 1) % seg) * mseg + k, ((i + 1) % seg) * mseg + (k + 1) % mseg
            bm.faces.new([bv[a0], bv[b0], bv[b1], bv[a1]])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for f in me.polygons:
        f.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    me.materials.append(new_material(name, color=(1.0, 0.72, 0.25, 1), rough=0.22, metal=1.0))
    parent_to_bone(ob, RIG, bone)
    return ob
torus_on('lowerarm_l', None, 0.031, 0.006, 0.93, 'chief_watch')
torus_on('ring_01_r', None, 0.0095, 0.0022, 0.45, 'chief_ring')

# Tidy: drop helper/joint vertex groups.
for o in [x for x in bpy.data.objects if x.type == 'MESH']:
    for g in list(o.vertex_groups):
        if g.name not in RIG.data.bones:
            o.vertex_groups.remove(g)
for o in bpy.data.objects:
    if o.type == 'MESH':
        print('PART', o.name, len(o.data.polygons), [m.name for m in o.data.materials])
bpy.ops.wm.save_as_mainfile(filepath=out)

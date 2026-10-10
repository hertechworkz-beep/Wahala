# Shared character-dressing tools for MakeHuman bodies (Blender 5.x, bpy module).
# Everything here is generated: skin bakes, hair/beard shells, garments that follow the
# skeleton, rigid accessories on bones. No third-party art.
import bpy, bmesh, math, random, os
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree


def clean_scene():
    for n in ('Cube', 'Camera', 'Light'):
        o = bpy.data.objects.get(n)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)


def bone_weights(obj):
    """Per-vertex dict {group_name: weight}."""
    names = {g.index: g.name for g in obj.vertex_groups}
    return [{names[g.group]: g.weight for g in v.groups} for v in obj.data.vertices]


def dominant(wdict, bones):
    best, bw = None, 0
    for k, w in wdict.items():
        if k in bones and w > bw:
            best, bw = k, w
    return best, bw


def group_verts(obj, name):
    g = obj.vertex_groups.get(name)
    if not g:
        return []
    return [v.index for v in obj.data.vertices if any(x.group == g.index and x.weight > 0.3 for x in v.groups)]


def centroid(obj, idx):
    mw = obj.matrix_world
    pts = [mw @ obj.data.vertices[i].co for i in idx]
    return sum(pts, Vector()) / max(1, len(pts))


def new_material(name, color=(0.5, 0.5, 0.5, 1), rough=0.5, metal=0.0, image=None, alpha_clip=None, normal_image=None, emission=None, sheen=0.0):
    sheen = 0.0  # sheen washes reds out to pink, and glTF viewers render it inconsistently
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = color
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if 'Specular IOR Level' in p.inputs and metal == 0:
        p.inputs['Specular IOR Level'].default_value = 0.3
    if sheen and 'Sheen Weight' in p.inputs:
        p.inputs['Sheen Weight'].default_value = sheen
    if image is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = image
        nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
        if alpha_clip is not None:
            nt.links.new(t.outputs['Alpha'], p.inputs['Alpha'])
            m.blend_method = 'CLIP' if hasattr(m, 'blend_method') else None
            try:
                m.alpha_threshold = alpha_clip
            except Exception:
                pass
    if normal_image is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = normal_image
        t.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    return m


def np_image(name, arr, alpha=False):
    """Creates a Blender image from an HxWx4 float array (0..1), stored packed."""
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=alpha)
    img.pixels.foreach_set(np.flipud(arr).astype(np.float32).ravel())
    img.pack()
    return img


def strand_texture(name, size=512, base=(0.12, 0.11, 0.1), grey=0.6, density=5200, length=(10, 26), seed=1, angle_jitter=0.35, under=0.0):
    """Short hair strands on a transparent background (for shells). grey = share of grey hairs."""
    rng = np.random.default_rng(seed)
    arr = np.zeros((size, size, 4), np.float32)
    if under > 0:  # a dense short undercoat so the skin doesn't show through in patches
        arr[..., :3] = np.array(base) * 0.9
        arr[..., 3] = under
    for _ in range(density):
        x, y = rng.uniform(0, size, 2)
        L = rng.uniform(*length)
        a = math.pi / 2 + rng.normal(0, angle_jitter)
        g = rng.random() < grey
        c = np.array([0.72, 0.7, 0.68]) * rng.uniform(0.8, 1.1) if g else np.array(base) * rng.uniform(0.6, 1.3)
        steps = int(L)
        for s in range(steps):
            px = int(x + math.cos(a) * s) % size
            py = int(y + math.sin(a) * s) % size
            t = s / steps
            arr[py, px, :3] = c
            arr[py, px, 3] = max(arr[py, px, 3], 1.0 - 0.6 * t)
    return np_image(name, arr, alpha=True)


def shell(obj, faces_sel, name, offsets, material, vgroups_from=None, uv_repeat=None):
    """Duplicates the selected faces as offset shells (fur shells). Keeps vertex groups and shape keys,
    so the shells follow the skeleton and the facial expressions."""
    bpy.ops.object.select_all(action='DESELECT')
    shells = []
    for li, off in enumerate(offsets):
        dup = obj.copy()
        dup.data = obj.data.copy()
        dup.name = f'{name}_{li}'
        bpy.context.collection.objects.link(dup)
        me = dup.data
        keep = set(faces_sel)
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
        bm.to_mesh(me)
        bm.free()
        me.update()
        # Offset basis and every shape key along the basis normals.
        normals = [v.normal.copy() for v in me.vertices]
        if me.shape_keys:
            for kb in me.shape_keys.key_blocks:
                for i, d in enumerate(kb.data):
                    d.co = d.co + normals[i] * off
        for i, v in enumerate(me.vertices):
            v.co = v.co + normals[i] * off
        uvl = me.uv_layers.active
        if uv_repeat and uvl is not None and len(uvl.data):
            us = [d.uv.copy() for d in uvl.data]
            u0, u1 = min(u.x for u in us), max(u.x for u in us)
            v0, v1 = min(u.y for u in us), max(u.y for u in us)
            s = max(u1 - u0, v1 - v0, 1e-6)
            for d in uvl.data:
                d.uv = ((d.uv.x - u0) / s * uv_repeat, (d.uv.y - v0) / s * uv_repeat)
        me.materials.clear()
        me.materials.append(material[li] if isinstance(material, (list, tuple)) else material)
        shells.append(dup)
    return shells


def faces_where(obj, pred):
    mw = obj.matrix_world
    out = []
    for p in obj.data.polygons:
        c = mw @ p.center
        if pred(c, p):
            out.append(p.index)
    return out


def delete_faces(obj, faces):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    sel = set(faces)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index in sel], context='FACES')
    bm.to_mesh(me)
    bm.free()
    me.update()


def parent_to_bone(obj, rig, bone):
    mw = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    obj.matrix_world = mw


def skin_from_body(obj, body, rig):
    """Gives a garment the body's skinning: nearest-surface weight transfer, then an Armature modifier."""
    for g in body.vertex_groups:
        if g.name in rig.data.bones and g.name not in obj.vertex_groups:
            obj.vertex_groups.new(name=g.name)
    dt = obj.modifiers.new('wt', 'DATA_TRANSFER')
    dt.object = body
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=dt.name)
    # Keep only bones that exist; normalise.
    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    am = obj.modifiers.new('Armature', 'ARMATURE')
    am.object = rig


def smooth_mesh(obj, iterations=20, factor=0.5):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    for _ in range(iterations):
        bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=factor, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(obj.data); bm.free(); obj.data.update()


def bake_to_image(obj, material, size, name, kind='EMIT'):
    """Bakes a material's emission (procedural colour) into a UV image and returns it."""
    img = bpy.data.images.new(name, size, size, alpha=False)
    if kind == 'NORMAL':
        img.colorspace_settings.name = 'Non-Color'
    nt = material.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    for n in nt.nodes:
        n.select = False
    tex.select = True
    nt.nodes.active = tex
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 1
    sc.render.bake.margin = 8
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type=kind)
    img.pack()
    nt.nodes.remove(tex)
    return img

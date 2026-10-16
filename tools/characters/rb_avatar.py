# Converts a Microsoft Rocketbox avatar (MIT, 3ds Max Biped skeleton) into a game-ready GLB:
#   - the "_facial" export's face shapes are kept only for ARKit (52) and visemes (15), renamed to
#     the standard names (eyeBlinkLeft, jawOpen, viseme_aa ...) so any face driver works on any avatar
#   - textures relinked from the avatar's Textures folder; hair/lashes use alpha clipping
#   - scale applied (Rocketbox is in centimetres), helper objects and the bind animation removed
# Usage: python rb_avatar.py <Avatar>_facial.fbx <out.glb>
import bpy, sys, os, re
src, out = sys.argv[-2], sys.argv[-1]
tex_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(src))), 'Textures')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=False)
for o in [o for o in bpy.data.objects if o.type == 'EMPTY']:
    bpy.data.objects.remove(o, do_unlink=True)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
mesh = [o for o in bpy.data.objects if o.type == 'MESH'][0]
arm.animation_data_clear()
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

# Face shapes
def arkit_name(n):
    m = re.match(r'AK_\d+_(\w+)$', n)
    return m.group(1)[0].lower() + m.group(1)[1:] if m else None
def viseme_name(n):
    m = re.match(r'AA_VI_\d+_(\w+)$', n)
    return 'viseme_' + m.group(1) if m else None
keys = mesh.data.shape_keys.key_blocks if mesh.data.shape_keys else []
bpy.context.view_layer.objects.active = mesh
for k in list(keys)[1:]:
    new = arkit_name(k.name) or viseme_name(k.name)
    if new:
        k.name = new
    else:
        mesh.shape_key_remove(k)

# Materials: colour + normal; anything with an opacity map is alpha-clipped (hair, lashes)
for m in mesh.data.materials:
    nt = m.node_tree
    bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    for n in [n for n in nt.nodes if n.type == 'TEX_IMAGE']:
        fn = os.path.basename(n.image.filepath.replace('\\', '/'))
        p = os.path.join(tex_dir, fn)
        if os.path.exists(p):
            n.image = bpy.data.images.load(p, check_existing=True)
        if fn.endswith('_specular.tga'):
            for l in list(n.outputs[0].links):
                nt.links.remove(l)
    bsdf.inputs['Roughness'].default_value = 0.62
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.35
    if 'opacity' in m.name:
        col = [n for n in nt.nodes if n.type == 'TEX_IMAGE' and '_color' in n.image.filepath][0]
        nt.links.new(col.outputs['Alpha'], bsdf.inputs['Alpha'])
        m.blend_method = 'CLIP' if hasattr(m, 'blend_method') else m.blend_method
        m.alpha_threshold = 0.4 if hasattr(m, 'alpha_threshold') else 0
        m.surface_render_method = 'DITHERED'
    else:
        bsdf.inputs['Alpha'].default_value = 1.0
        for l in list(bsdf.inputs['Alpha'].links):
            nt.links.remove(l)
        m.surface_render_method = 'DITHERED'
        m.blend_method = 'OPAQUE' if hasattr(m, 'blend_method') else None

# Apply the centimetre scale so bones and mesh are in metres
bpy.ops.object.select_all(action='DESELECT')
for o in (arm, mesh):
    o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
mesh.name = os.path.basename(out).replace('.glb', '')
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
bpy.ops.wm.save_as_mainfile(filepath=out.replace('.glb', '.blend'))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False, export_skins=True, export_morph=True, export_morph_normal=False,
                          export_apply=False, export_yup=True, export_image_format='WEBP', export_image_quality=85, export_cameras=False, export_lights=False)
print('KEYS', len(mesh.data.shape_keys.key_blocks) - 1 if mesh.data.shape_keys else 0, 'EXPORTED', out, os.path.getsize(out))

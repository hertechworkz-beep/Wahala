import bpy, sys, math, mathutils, os
blend, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 360, 560
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.1, 0.09, 0.1, 1)
def light(name, loc, energy, size):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (mathutils.Vector((0, 0, 0.9)) - o.location).to_track_quat('-Z', 'Y').to_euler()
light('key', (2.0, -2.5, 2.6), 380, 2.0); light('fill', (-2.5, -1.5, 1.6), 140, 3.0)
# a chair-height box so the sit can be judged
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.42, 0.23)); ch = bpy.context.object; ch.scale = (0.45, 0.45, 0.46)
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
rig = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for t in rig.animation_data.nla_tracks:
    t.mute = True
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
shots = [s.split(':') for s in os.environ['SHOTS'].split(',')]
for i, (act, frame, ang) in enumerate(shots):
    a = bpy.data.actions[act]
    rig.animation_data.action = a
    if hasattr(rig.animation_data, 'action_slot') and a.slots:
        rig.animation_data.action_slot = a.slots[0]
    sc.frame_set(int(frame))
    ch.hide_render = not act.startswith('sit')
    r = math.radians(float(ang))
    cam.location = (math.sin(r) * 4.2, -math.cos(r) * 4.2, 1.0)
    cam.rotation_euler = (mathutils.Vector((0, 0, 0.85)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{out}_{i}.png'
    bpy.ops.render.render(write_still=True)

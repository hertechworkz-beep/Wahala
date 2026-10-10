# Renders an object from several angles with soft studio light (Cycles CPU), for review sheets.
import bpy, sys, math, mathutils
blend, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 32; sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y = 420, 760
sc.render.film_transparent = False
sc.view_settings.view_transform = 'Standard'
import os
if os.environ.get('FACE'): sc.render.resolution_x, sc.render.resolution_y = 700, 760
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.08, 0.07, 0.08, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.6
def light(name, loc, energy, size):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc
    d = mathutils.Vector((0, 0, 1.0)) - o.location; o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
light('key', (2.0, -2.5, 2.6), 380, 2.0); light('fill', (-2.5, -1.5, 1.6), 140, 3.0); light('rim', (0.5, 2.5, 2.4), 220, 1.5)
meshes = [o for o in sc.objects if o.type == 'MESH']
zmax = max((o.matrix_world @ mathutils.Vector(c)).z for o in meshes for c in o.bound_box)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50
views = [(0, 4.4, zmax * 0.52, 'full'), (35, 4.4, zmax * 0.52, 'full'), (90, 4.4, zmax * 0.52, 'full'), (20, 1.1, zmax * 0.92, 'face')]
views = [(10, 0.75, zmax * 0.915, 'face'), (40, 0.75, zmax * 0.915, 'face')] if os.environ.get('FACE') else views
for i, (ang, dist, h, kind) in enumerate(views):
    a = math.radians(ang)
    cam.location = (math.sin(a) * dist, -math.cos(a) * dist, h)
    tgt = mathutils.Vector((0, 0, h))
    cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{out}_{i}.png'
    bpy.ops.render.render(write_still=True)

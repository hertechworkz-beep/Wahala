import bpy, sys
src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
print('ARM', arm.name, 'actions', [a.name for a in bpy.data.actions])
for o in bpy.data.objects: print('OBJ', o.name, o.type, tuple(round(x,3) for x in o.dimensions))
# rest pose landmarks
for n in ['mixamorig:Hips','mixamorig:LeftArm','mixamorig:LeftForeArm','mixamorig:LeftHand','mixamorig:Head','mixamorig:LeftFoot']:
    b = arm.data.bones[n]; print('REST', n, tuple(round(x,3) for x in arm.matrix_world @ b.head_local))
if arm.animation_data: arm.animation_data.action = None
for pb in arm.pose.bones: pb.matrix_basis.identity()
bpy.ops.wm.save_as_mainfile(filepath=out)

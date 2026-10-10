import sys, os, bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mpfb_boot import svc
HumanService = svc('humanservice', 'HumanService')
TargetService = svc('targetservice', 'TargetService')
ExportService = svc('exportservice', 'ExportService')
LocationService = svc('locationservice', 'LocationService')
T = LocationService.get_mpfb_data('targets')
MH = os.environ['MH_DATA']

AGE_59 = 0.5 + (59 - 25) / (90 - 25) * 0.5
macro = {"gender": 1.0, "age": AGE_59, "muscle": 0.42, "weight": 0.86, "proportions": 0.55, "height": 0.52,
         "cupsize": 0.5, "firmness": 0.5, "race": {"african": 1.0, "asian": 0.0, "caucasian": 0.0}}
h = HumanService.create_human(macro_detail_dict=macro)
DETAIL = {
  'stomach/stomach-pregnant-incr': 0.55, 'neck/neck-double-incr': 0.6, 'neck/measure-neck-circ-incr': 0.5,
  'head/head-fat-incr': 0.45, 'head/head-round': 0.3, 'head/head-age-incr': 0.6,
  'cheek/l-cheek-volume-incr': 0.4, 'cheek/r-cheek-volume-incr': 0.4,
  'nose/nose-flaring-incr': 0.45, 'nose/nose-scale-horiz-incr': 0.35, 'nose/nose-volume-incr': 0.2,
  'mouth/mouth-lowerlip-volume-incr': 0.3, 'mouth/mouth-upperlip-volume-incr': 0.2, 'mouth/mouth-laugh-lines-in': 0.5,
}
for k, w in DETAIL.items():
    TargetService.load_target(h, os.path.join(T, k + '.target.gz'), weight=w)
TargetService.bake_targets(h)
# Facial expression shapes for speech, blinking and smiling (MakeHuman expression units, African set).
U = os.path.join(T, 'expression', 'units', 'african')
for name, f in [('mouthOpen', 'mouth-open'), ('blinkL', 'eye-left-closure'), ('blinkR', 'eye-right-closure'), ('smile', 'mouth-corner-puller'), ('browsUp', 'eyebrows-left-inner-up')]:
    TargetService.load_target(h, os.path.join(U, f + '.target.gz'), weight=0.0, name=name)
rig = HumanService.add_builtin_rig(h, os.environ.get('RIG', 'game_engine'))
HumanService.add_mhclo_asset(os.path.join(MH, 'eyes/low-poly/low-poly.mhclo'), h, asset_type='Eyes')
ExportService.bake_modifiers_remove_helpers(h, bake_masks=True, remove_helpers=True)
bpy.context.view_layer.update()
for o in bpy.data.objects:
    sk = [k.name for k in o.data.shape_keys.key_blocks] if o.type == 'MESH' and o.data.shape_keys else []
    print('OBJ', o.name, o.type, o.parent.name if o.parent else '-', len(o.data.vertices) if o.type == 'MESH' else (len(o.data.bones) if o.type == 'ARMATURE' else ''), sk[:12], [m.type for m in o.modifiers] if o.type=='MESH' else '')
print('BONES', [b.name for b in rig.data.bones])
bpy.ops.wm.save_as_mainfile(filepath=sys.argv[-1])

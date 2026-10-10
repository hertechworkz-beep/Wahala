# Installs MPFB as a user extension (once) and enables it. Import this first in every build script.
import bpy, os, shutil, sys, addon_utils
SRC = os.environ['MPFB_SRC']
ext_root = os.path.join(bpy.utils.user_resource('EXTENSIONS'), 'user_default')
dst = os.path.join(ext_root, 'mpfb')
if not os.path.isdir(dst):
    os.makedirs(ext_root, exist_ok=True)
    shutil.copytree(SRC, dst)
bpy.utils.refresh_script_paths()
addon_utils.extensions_refresh() if hasattr(addon_utils, 'extensions_refresh') else None
mod = addon_utils.enable('bl_ext.user_default.mpfb', default_set=True, handle_error=lambda e: print('ENABLE ERR', e))
import importlib
def svc(name, key):
    m = importlib.import_module('bl_ext.user_default.mpfb.services.' + name)
    return getattr(m, key)

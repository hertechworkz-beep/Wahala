// Repackages .glb models as glTF JSON with the binary chunk embedded (base64), for hosts that
// only serve text/JSON (the claude.ai preview). Same model, same compression.
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
const walk = (d) => readdirSync(d).flatMap((x) => (statSync(join(d, x)).isDirectory() ? walk(join(d, x)) : [join(d, x)]));
for (const path of walk(process.argv[2]).filter((x) => x.endsWith('.glb'))) {
  const f = path;
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${f} is not a GLB`);
  let off = 12, json = null, bin = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    const chunk = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  if (bin) json.buffers[0].uri = 'data:application/octet-stream;base64,' + bin.toString('base64');
  writeFileSync(f.replace(/\.glb$/, '.gltf.json'), JSON.stringify(json));
  unlinkSync(f);
  console.log(f, '->', f.replace(/\.glb$/, '.gltf.json'));
}

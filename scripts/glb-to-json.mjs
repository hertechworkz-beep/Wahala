// Repackages .glb models as glTF JSON with the binary chunk embedded (base64), for hosts that
// only serve text/JSON (the claude.ai preview). Same model, same compression.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.glb'))) {
  const b = readFileSync(join(dir, f));
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
  writeFileSync(join(dir, f.replace(/\.glb$/, '.gltf.json')), JSON.stringify(json));
  console.log(f, '->', f.replace(/\.glb$/, '.gltf.json'));
}

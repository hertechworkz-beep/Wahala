#!/usr/bin/env node
// Meshy asset factory. Each asset is a job file (tools/meshy/jobs/*.json); this script submits it to
// the Meshy API, waits, and downloads the result into art-src/. Steps chain: a model can be
// generated, then rigged, then given animations, all from one job.
//
//   MESHY_API_KEY must be set (environment settings, never pasted in chat); api.meshy.ai allowed.
//   node tools/meshy/meshy.mjs jobs/prado.json          run one job
//   node tools/meshy/meshy.mjs jobs/*.json              run several
//
// Job shape (all steps optional, run in order):
//   { "name": "prado", "out": "art-src/vehicles",
//     "text": { "prompt": "...", "art_style": "realistic", "negative_prompt": "..." },   text-to-3D (preview, then refine)
//     "image": { "file": "public/art/chief_charming.webp" },                             image-to-3D
//     "model": "art-src/chief/chief_meshy_source.glb",                                   or start from a model we have
//     "rig": { "height_meters": 1.78 },                                                  auto-rig a humanoid
//     "animations": [ { "name": "hug", "action_id": 0 } ] }                              Meshy library actions
//
// Endpoints follow Meshy's OpenAPI (v1/v2). Responses are logged in full so a changed field is easy to spot.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const KEY = process.env.MESHY_API_KEY;
const API = process.env.MESHY_API ?? 'https://api.meshy.ai/openapi';
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
if (!KEY) {
  console.error('MESHY_API_KEY is not set. Add it in the cloud environment settings (Edit → environment variables), then start a new session.');
  process.exit(2);
}

async function call(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 500)}`);
  return json;
}

async function wait(path, id, label) {
  for (let i = 0; ; i++) {
    const t = await call('GET', `${path}/${id}`);
    process.stdout.write(`\r${label}: ${t.status} ${t.progress ?? ''}%   `);
    if (t.status === 'SUCCEEDED') return (console.log(), t);
    if (t.status === 'FAILED' || t.status === 'CANCELED' || t.status === 'EXPIRED') throw new Error(`${label} ${t.status}: ${JSON.stringify(t.task_error ?? t)}`);
    await new Promise((r) => setTimeout(r, Math.min(15000, 3000 + i * 1000)));
  }
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${url} → ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  console.log('saved', file);
}

const dataUri = (file) => {
  const ext = extname(file).slice(1).toLowerCase();
  const mime = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', glb: 'model/gltf-binary' }[ext] ?? 'application/octet-stream';
  return `data:${mime};base64,${readFileSync(join(ROOT, file)).toString('base64')}`;
};

async function run(jobFile) {
  const job = JSON.parse(readFileSync(resolve(jobFile), 'utf8'));
  const out = join(ROOT, job.out ?? 'art-src/meshy');
  mkdirSync(out, { recursive: true });
  const name = job.name ?? basename(jobFile, '.json');
  const log = { job: name, steps: [] };
  let taskForRig = null, modelUrl = null;

  if (job.text) {
    const pre = await call('POST', '/v2/text-to-3d', { mode: 'preview', art_style: 'realistic', should_remesh: true, ...job.text });
    const p = await wait('/v2/text-to-3d', pre.result, `${name} preview`);
    const ref = await call('POST', '/v2/text-to-3d', { mode: 'refine', preview_task_id: pre.result, enable_pbr: true });
    const t = await wait('/v2/text-to-3d', ref.result, `${name} refine`);
    log.steps.push({ text: t });
    await download(t.model_urls.glb, join(out, `${name}.glb`));
    taskForRig = ref.result;
    void p;
  }
  if (job.image) {
    const res = await call('POST', '/v1/image-to-3d', { image_url: dataUri(job.image.file), enable_pbr: true, should_remesh: true, should_texture: true, ...job.image.options });
    const t = await wait('/v1/image-to-3d', res.result, `${name} image-to-3d`);
    log.steps.push({ image: t });
    await download(t.model_urls.glb, join(out, `${name}.glb`));
    taskForRig = res.result;
  }
  if (job.model) modelUrl = dataUri(job.model);
  if (job.rig) {
    const body = { height_meters: job.rig.height_meters ?? 1.75, ...(taskForRig ? { input_task_id: taskForRig } : { model_url: modelUrl }) };
    const res = await call('POST', '/v1/rigging', body);
    const t = await wait('/v1/rigging', res.result, `${name} rigging`);
    log.steps.push({ rig: t });
    const R = t.result ?? {};
    if (R.rigged_character_glb_url) await download(R.rigged_character_glb_url, join(out, `${name}_rigged.glb`));
    for (const [k, url] of Object.entries(R.basic_animations ?? {})) if (/glb_url$/.test(k) && url) await download(url, join(out, `${name}_${k.replace(/_glb_url$/, '')}.glb`));
    for (const a of job.animations ?? []) {
      const ar = await call('POST', '/v1/animations', { rig_task_id: res.result, action_id: a.action_id });
      const at = await wait('/v1/animations', ar.result, `${name} ${a.name}`);
      log.steps.push({ animation: a.name, task: at });
      const url = at.result?.animation_glb_url ?? at.animation_glb_url;
      if (url) await download(url, join(out, `${name}_${a.name}.glb`));
    }
  }
  writeFileSync(join(out, `${name}.meshy.json`), JSON.stringify(log, null, 1));
}

for (const f of process.argv.slice(2)) {
  try {
    await run(f);
  } catch (e) {
    console.error(`\n${f}: ${e.message}`);
    process.exitCode = 1;
  }
}

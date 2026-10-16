#!/usr/bin/env node
// Voices every line in the 3D scenes with ElevenLabs (paid plan with commercial rights).
// Lines come from the scene configs, so new lines are voiced by re-running this; recordings that
// already exist are skipped (a human recording with the same id is never overwritten).
//
//   ELEVENLABS_API_KEY must be set (environment settings, never in chat); api.elevenlabs.io allowed.
//   npx tsx tools/voice/elevenlabs.mjs --pick     search the voice library and propose a voice per character
//   npx tsx tools/voice/elevenlabs.mjs            generate every missing line into public/audio/voices/<who>/<id>.mp3
//
// Voice choices live in tools/voice/voices.json (character → voice_id), so they can be reviewed and changed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { firstDate } from '../../src/three/scenes/firstDate.ts';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error('ELEVENLABS_API_KEY is not set. Add it in the cloud environment settings, then start a new session.');
  process.exit(2);
}
const API = 'https://api.elevenlabs.io/v1';
const VOICES = new URL('./voices.json', import.meta.url).pathname;
const h = { 'xi-api-key': KEY, 'Content-Type': 'application/json' };

// Who speaks each pool in a date scene ('date' = the scene's date, 'diners' = every seated extra).
const SPEAKER = { arrive: 'date', smalltalk: 'date', toast: 'date', leftAlone: 'date', welcomeBack: 'date', playerReply: 'player', waiterServe: 'waiter', waiterTapped: 'waiter', seatTaken: 'diners', dinerTapped: 'diners' };
// What each character should sound like, for --pick.
const CASTING = {
  chief: { gender: 'male', search: 'nigerian', age: 'old', note: 'deep, warm, unhurried, wealthy Igbo man around 60' },
  player: { gender: 'female', search: 'nigerian', age: 'young', note: 'young Lagos woman, bright, a little teasing' },
  waiter: { gender: 'male', search: 'nigerian', age: 'young', note: 'polite, soft-spoken' },
  diner_m1: { gender: 'male', search: 'nigerian', age: 'middle_aged' },
  diner_m2: { gender: 'male', search: 'african', age: 'middle_aged' },
  diner_f1: { gender: 'female', search: 'nigerian', age: 'middle_aged' },
};

async function pick() {
  const chosen = existsSync(VOICES) ? JSON.parse(readFileSync(VOICES, 'utf8')) : {};
  for (const [who, c] of Object.entries(CASTING)) {
    if (chosen[who]) continue;
    const q = new URLSearchParams({ page_size: '10', gender: c.gender, search: c.search, ...(c.age ? { age: c.age } : {}) });
    const r = await fetch(`${API}/shared-voices?${q}`, { headers: h }).then((r) => r.json());
    const v = (r.voices ?? [])[0];
    if (!v) { console.log(who, 'no match; set a voice_id by hand'); continue; }
    // add the library voice to our account so it can be used
    await fetch(`${API}/voices/add/${v.public_owner_id}/${v.voice_id}`, { method: 'POST', headers: h, body: JSON.stringify({ new_name: `wahala_${who}` }) });
    chosen[who] = { voice_id: v.voice_id, name: v.name, accent: v.accent, preview: v.preview_url };
    console.log(who, '→', v.name, v.accent, v.preview_url);
  }
  writeFileSync(VOICES, JSON.stringify(chosen, null, 1));
}

async function generate() {
  const chosen = JSON.parse(readFileSync(VOICES, 'utf8'));
  const scenes = [firstDate];
  const jobs = [];
  for (const s of scenes) {
    const diners = s.extras.filter((e) => 'seat' in e).map((e) => e.who);
    const waiter = s.extras.find((e) => 'patrol' in e)?.who ?? 'waiter';
    for (const [pool, lines] of Object.entries(s.lines)) {
      const sp = SPEAKER[pool];
      const whos = sp === 'date' ? [s.date.voiceKey] : sp === 'diners' ? diners : sp === 'waiter' ? [waiter] : ['player'];
      for (const who of whos) for (const l of lines) jobs.push({ who, ...l });
    }
  }
  for (const j of jobs) {
    const file = `public/audio/voices/${j.who}/${j.id}.mp3`;
    if (existsSync(file)) continue;
    const v = chosen[j.who];
    if (!v) { console.log('no voice for', j.who); continue; }
    const r = await fetch(`${API}/text-to-speech/${v.voice_id}?output_format=mp3_44100_96`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ text: j.text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 } }),
    });
    if (!r.ok) { console.log('failed', j.who, j.id, r.status, (await r.text()).slice(0, 200)); continue; }
    mkdirSync(`public/audio/voices/${j.who}`, { recursive: true });
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    console.log('voiced', file);
  }
}

if (process.argv.includes('--pick')) await pick();
else await generate();

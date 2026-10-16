// Everyone who can appear in a 3D scene, as data. A person is a model plus either its own clips
// or a shared animation library for its skeleton (every Rocketbox body uses the same Biped clips),
// and a voice. New people are new entries here, not new code.

export interface Voice {
  male: boolean;
  pitch?: number;
  rate?: number;
}
/**
 * Casting (brief Part 29): in Lagos, main characters, player avatar options and the large majority
 * of NPCs are Black African with authentic African features, across the full range of skin tones.
 * Non-African people appear only as a small share of background characters (expats, tourists,
 * business visitors), never in a story role. The content validator enforces this.
 */
export type Heritage = 'black_african' | 'non_african';
export type CastRole = 'story' | 'player' | 'npc' | 'background_expat';

export interface PersonDef {
  name: string;
  heritage: Heritage;
  role: CastRole;
  source: string; // where the body comes from, for the casting audit
  model: string; // under public/
  meta?: string; // the model's own clip facts (when it carries its own clips)
  library?: keyof typeof LIBRARIES;
  voice: Voice;
}

export const LIBRARIES = {
  rb_female: { model: 'models/anims/rb_female.glb', meta: 'models/anims/rb_female.clips.json' },
  rb_male: { model: 'models/anims/rb_male.glb', meta: 'models/anims/rb_male.clips.json' },
};

export const PEOPLE: Record<string, PersonDef> = {
  chief: { name: 'Chief', heritage: 'black_african', role: 'story', source: 'Meshy (approved Chief)', model: 'models/chief.glb', meta: 'models/chief.clips.json', voice: { male: true, pitch: 0.7, rate: 0.9 } },
  player_f: { name: 'You', heritage: 'black_african', role: 'player', source: 'Rocketbox Business_Female_01', model: 'models/people/player_f.glb', library: 'rb_female', voice: { male: false, pitch: 1.05, rate: 1 } },
  diner_m1: { name: 'Diner', heritage: 'black_african', role: 'npc', source: 'Rocketbox Male_Adult_04', model: 'models/people/diner_m1.glb', library: 'rb_male', voice: { male: true, pitch: 0.9 } },
  diner_m2: { name: 'Diner', heritage: 'black_african', role: 'npc', source: 'Rocketbox Male_Adult_18', model: 'models/people/diner_m2.glb', library: 'rb_male', voice: { male: true, pitch: 0.95 } },
  diner_f1: { name: 'Diner', heritage: 'black_african', role: 'npc', source: 'Rocketbox Pilot_Female_02 (off-duty crew)', model: 'models/people/diner_f1.glb', library: 'rb_female', voice: { male: false } },
  waiter: { name: 'Waiter', heritage: 'black_african', role: 'npc', source: 'Rocketbox Male_Adult_12', model: 'models/people/waiter.glb', library: 'rb_male', voice: { male: true, pitch: 1.0, rate: 1.05 } },
};


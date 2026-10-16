// Everyone who can appear in a 3D scene, as data. A person is a model plus either its own clips
// or a shared animation library for its skeleton (every Rocketbox body uses the same Biped clips),
// and a voice. New people are new entries here, not new code.

export interface Voice {
  male: boolean;
  pitch?: number;
  rate?: number;
}
export interface PersonDef {
  name: string;
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
  chief: { name: 'Chief', model: 'models/chief.glb', meta: 'models/chief.clips.json', voice: { male: true, pitch: 0.7, rate: 0.9 } },
  player_f: { name: 'You', model: 'models/people/player_f.glb', library: 'rb_female', voice: { male: false, pitch: 1.05, rate: 1 } },
  diner_m1: { name: 'Diner', model: 'models/people/diner_m1.glb', library: 'rb_male', voice: { male: true, pitch: 0.9 } },
  diner_m2: { name: 'Diner', model: 'models/people/diner_m2.glb', library: 'rb_male', voice: { male: true, pitch: 0.95 } },
  diner_f1: { name: 'Diner', model: 'models/people/diner_f1.glb', library: 'rb_female', voice: { male: false } },
  waiter: { name: 'Waiter', model: 'models/people/waiter.glb', library: 'rb_male', voice: { male: true, pitch: 1.0, rate: 1.05 } },
};


// Core types for the Wahala engine. Content (JSON) and UI both build on these.
// The engine is city- and character-agnostic: everything specific lives in data/.

export type Gender = 'man' | 'woman' | 'nonbinary';
export type DatePref = 'men' | 'women' | 'both';
export type VibeId = 'lover' | 'sugar' | 'bigboy' | 'runs' | 'corporate';
export type GoalId = 'bag' | 'love' | 'ring' | 'revenge';
export type Knower = 'player' | 'partner' | 'world' | 'wife' | 'bestie' | 'amebo';

export type Slot =
  | 'first_date'
  | 'red_flag'
  | 'temptation'
  | 'public_drama'
  | 'money_trap'
  | 'confrontation'
  | 'payoff'
  | 'talking_time'
  | 'interrupt'
  | 'escalation'
  | 'finale';

export type EndingId =
  | 'locked_in'
  | 'counter_con'
  | 'survived'
  | 'scandal'
  | 'sapa'
  | 'breakdown'
  | 'ghosted'
  | 'fumbled'
  | 'obsession'
  | 'walked_away';

export type ChoiceTag =
  | 'toxic'
  | 'cautious'
  | 'investigate' // resolved to cautious or toxic by context (rule 19)
  | 'luxury'
  | 'budget'
  | 'public_embarrassment'
  | 'discreet'
  | 'independence'
  | 'contact_partner'
  | 'excuse' // ignoring/excusing a tell => Red Flag Missed
  | 'stay' // staying under control (rule 21)
  | 'exit' // a real exit under control (rule 21)
  | 'call_out'
  | 'loan';

/** Hidden + visible numeric state. */
export interface Meters {
  wallet: number;
  debt: number;
  sanity: number;
  clout: number;
  attachment: number;
  trust: number;
  chemistry: number;
  exposure: number;
  control: number;
  glow: number;
}
export type MeterKey = keyof Meters;

export interface FlagSet {
  flag: string;
  knows?: Knower[]; // defaults to ['player']
}

export interface Condition {
  flags?: string[]; // all must be set
  any_flags?: string[];
  not_flags?: string[];
  partner_knows?: string[];
  world_knows?: string[];
  knows?: { flag: string; who: Knower }[];
  truth?: string[];
  not_truth?: string[];
  good_one?: boolean;
  vibe?: VibeId[];
  goal?: GoalId[];
  player_gender?: Gender[];
  min?: Partial<Meters>;
  max?: Partial<Meters>;
  day_min?: number;
  day_max?: number;
  controlling?: boolean;
  spot_today?: string;
  bestie?: ('genius' | 'toxic')[];
  min_stays?: number;
  character?: string[];
  not_character?: string[];
  /** Days since a flag was set, at least `min`. */
  flag_age?: { flag: string; min: number };
}

export interface PhoneEvent {
  kind: 'text' | 'voice_note' | 'call' | 'alert' | 'gist' | 'missed_call';
  from: string; // template: {partner}, Bestie, Amebo, GTB etc.
  text: string;
  seconds?: number; // voice note length
}

export interface Effects {
  wallet?: number; // positive = gain, negative = cost
  sanity?: number;
  clout?: number;
  attachment?: number;
  trust?: number;
  bond?: number; // shorthand: applied to attachment AND trust
  chemistry?: number;
  exposure?: number;
  control?: number;
  glow?: number;
  debt?: number;
  goal?: Partial<Record<GoalId, number>>;
  set?: (string | FlagSet)[];
  reveal?: { flag: string; to: Knower[] }[];
  unset?: string[];
  expression?: string;
  fx?: string[];
  phone?: PhoneEvent[];
  saw_truth?: boolean; // player now knows the hidden truth (Counter-Con needs it)
  truth_exposed?: boolean; // hidden truth exposed publicly (Revenge goal)
  end?: EndingId; // rare: a choice that ends the run (e.g. leaving)
  no_scale?: boolean; // costs in this outcome are not scaled by tier
  /** Receipt line override for this outcome, in second person. */
  receipt?: string;
  /** Marks the bad branch of a dice roll so receipts can say "the dice said no". */
  bad?: boolean;
  /** Shown on the Verdict Card only because work actually mattered. */
  work_note?: string;
  /** Amebo twist: sells one of the player's `secret_*` flags to the partner. */
  leak_secret?: boolean;
  /** Intel: 'tell' gives a true tell hint; 'bestie' gives the Bestie's take (wrong if she is toxic). */
  intel?: 'tell' | 'bestie';
  /** Positive wallet amounts scale by the vibe tier too (refunds of a scaled cost). */
  scaled?: boolean;
  /** The partner deceived the player here; receipts record the cause as `tricked`. */
  tricked?: boolean;
}

export interface Outcome extends Effects {
  chance: number;
  text: string;
}

export interface Choice {
  id: string;
  label: string;
  tags?: ChoiceTag[];
  vibe?: VibeId; // vibe-only option
  requires?: Condition;
  cost?: number; // upfront base cost, scaled by tier; gates affordability
  /** Funny reason shown when unaffordable. */
  broke_text?: string;
  outcomes: Outcome[];
  /** Per-truth replacement outcomes (key = truth id, or 'good_one'). */
  truth_override?: Record<string, Outcome | Outcome[]>;
  /** Receipt template for choosing this (second person). */
  receipt?: string;
  /** Flags the partner reacts to in this choice; validator checks knowledge (rule 13). */
  partner_reacts_to?: string[];
  /** For Talking Time: this reply caught the hidden detail. */
  caught?: boolean;
}

export interface Beat {
  who: 'partner' | 'narration' | 'player' | string; // or an NPC name
  text: string;
  expression?: string;
}

export interface SceneSpec {
  location: string;
  time?: 'morning' | 'afternoon' | 'golden' | 'night';
  expression?: string;
  mood: 'positive' | 'neutral' | 'negative';
  fx?: string[]; // blackout, rain, shake, flash, generator, sirens
  props?: string[];
  partner_present?: boolean; // default true
  npc?: { name: string; look?: string };
}

export interface Card {
  id: string;
  character?: string; // undefined => shared deck
  slot: Slot;
  presentation?: 'scene' | 'call' | 'text' | 'voice_note';
  scene: SceneSpec;
  beats: Beat[];
  /** Tell shown per rolled truth: truth id -> tell id, or tell id plus card-specific wording. */
  tells?: Record<string, string | { id: string; text: string }>;
  /** Flags set as soon as the player acts on this card (applied before context tagging). */
  sets?: (string | FlagSet)[];
  /** Discovery: this card delivers these facts to someone (rule 18), e.g. a blog the partner reads. */
  discovers?: { flag: string; to: Knower[] }[];
  requires?: Condition;
  /** Flags this card pays off (rule 1). */
  payoff_of?: string[];
  /** Flags the partner reacts to in this card; validator checks knowledge (rule 13). */
  partner_reacts_to?: string[];
  priority?: number; // payoffs: higher plays first
  choices: Choice[];
  /** Talking Time: the hidden detail and what missing it costs. */
  detail?: { flag: string; missed: Effects; red_flag?: boolean };
  weight?: number;
}

export interface Tell {
  id: string;
  text: string; // as it appears in a card
  hint: string; // Clue Pass / Amebo phrasing: points at it, never names the truth
}

export interface Truth {
  id: string;
  kind: 'flawed' | 'good_one';
  label: string; // short name, e.g. "Serial sponsor"
  reveal: string; // "HIDDEN TRUTH: ..."
  tells: Tell[];
  lesson?: string;
}

export interface BehaviourRule {
  id: string;
  description: string;
  when: {
    tag?: ChoiceTag;
    spot?: string;
    day_min?: number;
    truth_kind?: 'flawed' | 'good_one';
    min?: Partial<Meters>;
  };
  effect: Effects;
  note?: string; // appended to outcome text
}

export interface Character {
  id: string;
  name: string;
  short: string; // "Chief"
  age: number;
  gender: 'man' | 'woman';
  group: string;
  pronouns: { he: string; him: string; his: string };
  public_card: string;
  signature_catch: string;
  archetype: string;
  temperament: { id: string; controlling: boolean; description: string };
  taste: { fixed: Record<'woman' | 'man', { build?: string; hair?: string; style?: string; facial?: string }>; pool: string[]; high_maintenance?: boolean };
  vibe_start: Record<VibeId, { attachment: number; trust: number; line: string }>;
  truths: Truth[];
  rules: BehaviourRule[];
  look: PortraitLook;
  endings: Partial<Record<EndingId, { title: string; text: string; scene?: SceneSpec; /** Per-truth rewrites, e.g. Locked In with a polygamous Chief vs a divorced one. */ truths?: Record<string, { title?: string; text: string }> }>>;
  /** 10 to 20 second animated scene that opens every run, before any choice. */
  cold_open?: ColdOpen;
  expressions: string[];
  chemistry_leaks?: { match: string; text: string }[];
  lessons?: Partial<Record<EndingId | 'default', string[]>>;
}

export interface ColdOpen {
  scene: SceneSpec;
  beats: (Beat & { at: number })[]; // seconds from start
  phone?: (PhoneEvent & { at: number })[];
  duration: number; // seconds
}

export interface MerchantFields {
  merchant_name: string | null;
  real_url: string | null;
  affiliate_url: string | null;
  address: string | null;
  map_url: string | null;
  sponsored: boolean;
  scene_tone_allowed: ('positive' | 'neutral')[];
}

export interface CatalogItem extends MerchantFields {
  id: string;
  kind: 'venue' | 'outfit' | 'gift';
  name: string;
  location?: string;
}

export interface PortraitLook {
  skin: string;
  hair: 'cap' | 'low' | 'bald' | 'braids' | 'frontal' | 'locs' | 'waves' | 'bun' | 'hijab' | 'curls' | 'gele' | 'natural';
  hairColor: string;
  outfit: string;
  outfitAccent: string;
  outfitStyle: 'agbada' | 'kaftan' | 'shirt' | 'jacket' | 'dress' | 'top' | 'senator';
  accessory?: 'gold_chain' | 'beads' | 'glasses' | 'earrings' | 'watch' | 'cap';
  beard?: boolean;
  beardStyle?: 'stubble' | 'full' | 'goatee';
  build?: 'broad' | 'slim' | 'average';
}

export interface Vibe {
  id: VibeId;
  label: { man: string; woman: string; nonbinary: string };
  wallet: number;
  sanity: number;
  clout: number;
  job: string;
  first_seen: string;
  tier: number; // cost scale factor (rule 7)
  salary: number; // small daily salary
  volatile?: boolean;
}

export interface Goal {
  id: GoalId;
  label: string;
  wins: string;
  roast: string;
}

export interface SpotOption {
  id: string;
  label: string;
  cost?: number;
  tags?: ChoiceTag[];
  requires?: Condition;
  outcomes: Outcome[];
  truth_override?: Record<string, Outcome | Outcome[]>;
  receipt?: string;
  broke_text?: string;
}

export interface Spot {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  location?: string;
  options: SpotOption[];
}

export interface CityContent {
  id: string;
  name: string;
  season: string;
  vibes: Vibe[];
  goals: Goal[];
  characters: Character[];
  cards: Card[];
  spots: Spot[];
  locations: LocationSpec[];
  titles: TitleRule[];
  lessons: LessonRule[];
  roasts: RoastRule[];
  rarity: Record<string, { runs: number; endings: Partial<Record<EndingId, number>> }>;
  launch: Record<string, { pass: boolean; errors: string[] }>;
  avatar: AvatarOptions;
  gossip: string[];
  brands: BrandInventory;
  catalog: CatalogItem[];
  brand: BrandInfo;
}

export interface BrandInfo {
  name: string;
  edition: string;
  social: { name: string; url: string | null }[];
}

export interface AvatarOptions {
  skins: { id: string; hex: string }[];
  build: { woman: string[]; man: string[] };
  hair: { woman: string[]; man: string[] };
  facial: { man: string[] };
  style: { woman: string[]; man: string[] };
}

export interface PlayerSetup {
  name: string;
  gender: Gender;
  datePref: DatePref;
  vibe: VibeId;
  goal: GoalId;
  avatar: { build: string; hair: string; style: string; set: 'woman' | 'man'; skin?: string; facial?: string };
}

export interface LocationSpec {
  id: string;
  name: string;
  place: string;
  palette: { sky: string[]; ground: string; accent: string; glow: string };
  layers: string[]; // ambient layer types rendered by the scene system
  ambience: string[]; // sound layer ids
  brand_slots?: string[];
  transition?: 'fade' | 'slide' | 'flash' | 'iris';
}

export interface TitleRule {
  title: string;
  endings?: EndingId[];
  goals?: GoalId[];
  vibes?: VibeId[];
  player_gender?: Gender[];
  good_one?: boolean;
  weight?: number;
}

export interface RoastRule {
  text: string;
  endings?: EndingId[];
  missed_min?: number;
}

export interface LessonRule {
  text: string;
  endings?: EndingId[];
  truths?: string[];
  good_one?: boolean;
}

export interface BrandSlot extends MerchantFields {
  id: string;
  name: string;
  where: string;
  rate: number; // ₦/week
  cap_per_run: number;
}

export interface BrandBooking extends MerchantFields {
  slot: string;
  brand: string;
  creative: { text?: string; image?: string; audio?: string; link?: string };
  starts: string;
  ends: string;
}

export interface BrandInventory {
  slots: BrandSlot[];
  bookings: BrandBooking[];
  house_ad: string;
}

// ---------------- Run state ----------------

export interface FlagState {
  day: number;
  knows: Knower[];
}

export type Cause = 'chosen' | 'tricked' | 'dice' | 'world';

export interface LoggedEvent {
  seq: number;
  day: number;
  card: string;
  slot: Slot | 'spot' | 'system';
  choice: string;
  choiceLabel: string;
  outcomeText: string;
  outcomeIndex: number;
  rolled: boolean; // randomness decided it (more than one outcome)
  bad: boolean; // the worse branch of a roll
  cause: Cause;
  deltas: Partial<Meters>;
  tags: ChoiceTag[];
  tellShown?: string;
  missedTell?: boolean;
  receipt?: string;
  score: number;
}

export type StepKind = 'talking_time' | 'main' | 'payoff' | 'interrupt' | 'escalation' | 'finale';

export interface Step {
  kind: StepKind;
  slot: Slot;
  cardId?: string; // filled at draw time
}

export type RunStatus = 'card' | 'day_end' | 'bailout' | 'ended';

export interface RunState {
  version: 1;
  status: RunStatus;
  seed: number;
  rng: number;
  city: string;
  player: PlayerSetup;
  characterId: string;
  truthId: string;
  goodOne: boolean;
  spark: boolean;
  bestie: 'genius' | 'toxic';
  tasteFav: string; // the per-run rolled favourite
  day: number; // 1..7
  stepIndex: number; // index into todaySteps
  todaySteps: Step[];
  slotOrder: Slot[]; // days 1..7
  interruptDays: number[];
  meters: Meters;
  start: { wallet: number; sanity: number; clout: number };
  flags: Record<string, FlagState>;
  seenCards: string[];
  log: LoggedEvent[];
  tellsShown: string[];
  redFlagsMissed: number;
  goalProgress: Partial<Record<GoalId, number>>;
  investigations: number;
  evidenceSinceInvestigation: number;
  stays: number;
  toxicCount: number;
  cluesUsed: number;
  bailoutUsed: boolean;
  spotDays: Record<number, string>; // day -> spot id used
  chemistryShown: number[];
  workMattered: string[];
  pendingEnding?: EndingId; // waiting for bail-out decision
  ending?: EndingId;
  endedDay?: number;
  sawTruth: boolean;
  truthExposed: boolean;
  payoffsPlayed: number;
  interruptsPlayed: number;
  money: { spent: number; received: number; borrowed: number; earned: number };
  history: { action: 'choose' | 'spot' | 'bailout' | 'decline_bailout' | 'clue' | 'next_day'; id: string; option?: string; loan?: boolean }[];
}

export interface ResolvedChoice {
  id: string;
  label: string;
  available: boolean;
  reason?: string; // greyed out reason
  cost: number; // scaled
  vibeOnly?: VibeId;
  canLoan: boolean;
  tags: ChoiceTag[];
}

export interface ResolvedCard {
  card: Card;
  beats: Beat[];
  tell?: Tell;
  choices: ResolvedChoice[];
  expression: string;
  location: string;
  time: string;
}

export interface ChoiceResult {
  text: string;
  notes: string[];
  deltas: Partial<Meters>;
  chemistryDelta?: number;
  phone: PhoneEvent[];
  expression?: string;
  fx: string[];
  rolled: boolean;
  bad: boolean;
  ending?: EndingId;
  pendingEnding?: EndingId;
}

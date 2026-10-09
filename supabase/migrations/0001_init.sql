-- Wahala Season 1 schema (BRIEF.md "Database tables" + engine rules 10, 11, 23).
-- Clients use anonymous auth. Clients may READ public data and INSERT their own rows;
-- anything that grants value (payments, bail-outs, rarity, counters) is written by the server only.

create table players (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 18),
  avatar jsonb not null,
  vibe text not null,
  free_bailouts int not null default 0,           -- earned by invites; server-written only
  created_at timestamptz not null default now()
);

create table runs (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references players on delete cascade,
  character text not null,
  goal text not null,
  seed bigint not null,
  history jsonb not null,                          -- the server replays seed + history to verify (rule 23)
  hidden_truth text,                               -- filled by the server's replay, never trusted from the client
  day_reached int,
  ending text,
  final_meters jsonb,
  verified boolean not null default false,
  card_image_url text,
  created_at timestamptz not null default now()
);
create index runs_character_ending on runs (character, ending) where verified;

create table parlour_posts (
  id uuid primary key default gen_random_uuid(),
  run uuid references runs on delete set null,
  author uuid references players on delete set null,
  type text not null check (type in ('receipt', 'auto_gossip', 'sponsored')),
  text text not null check (char_length(text) <= 400),
  reactions jsonb not null default '{"fire":0,"laugh":0,"flag":0,"clown":0}',
  reports int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table parlour_reactions (
  post uuid references parlour_posts on delete cascade,
  player uuid references players on delete cascade,
  reaction text not null check (reaction in ('fire', 'laugh', 'flag', 'clown')),
  primary key (post, player)
);

create table blocks (
  player uuid references players on delete cascade,
  blocked uuid references players on delete cascade,
  primary key (player, blocked)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references players,
  run uuid references runs,
  product text not null check (product in ('bailout', 'clue')),
  amount_kobo int not null,
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed', 'consumed')),
  paystack_ref text unique not null,
  created_at timestamptz not null default now()
);

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null,
  phase_interest text not null default 'phase2',
  created_at timestamptz not null default now()
);

create table squads (
  id uuid primary key default gen_random_uuid(),
  character text not null,
  members uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table events (
  id bigserial primary key,
  player uuid,
  name text not null,
  props jsonb,
  created_at timestamptz not null default now()
);

-- Real numbers only (rule 11): live counters come from verified runs.
create view live_counters as
select character,
       count(*) filter (where ending is null and created_at > now() - interval '30 minutes') as dating_now,
       count(*) filter (where ending = 'ghosted' and created_at > date_trunc('day', now())) as ghosted_today
from runs where verified or ending is null
group by character;

create view ending_rarity as
select character, ending, count(*)::float / sum(count(*)) over (partition by character) as share
from runs where verified and ending is not null
group by character, ending;

-- Row level security
alter table players enable row level security;
alter table runs enable row level security;
alter table parlour_posts enable row level security;
alter table parlour_reactions enable row level security;
alter table blocks enable row level security;
alter table payments enable row level security;
alter table waitlist enable row level security;
alter table squads enable row level security;
alter table events enable row level security;

create policy "own player" on players for select using (auth.uid() = id);
create policy "create own player" on players for insert with check (auth.uid() = id and free_bailouts = 0);
create policy "own runs" on runs for select using (auth.uid() = player);
create policy "start own run" on runs for insert with check (auth.uid() = player and verified = false and ending is null);
create policy "public feed" on parlour_posts for select using (not hidden);
create policy "leak own receipt" on parlour_posts for insert with check (auth.uid() = author and type = 'receipt');
create policy "react" on parlour_reactions for insert with check (auth.uid() = player);
create policy "block" on blocks for insert with check (auth.uid() = player);
create policy "own payments" on payments for select using (auth.uid() = player);
create policy "join waitlist" on waitlist for insert with check (true);
create policy "track" on events for insert with check (auth.uid() = player);
-- No update/delete policies: only service-role server code changes value-bearing rows.

# Wahala backend (not yet deployed)

The game plays fully offline; nothing here blocks a run. The shipped frontend uses
`LocalBackend` (`src/backend/index.ts`), which keeps payments OFF and shows no live
counters, as the brief allows ("if verification isn't working by launch, launch with
payments switched off") and rule 11 requires ("counters show real numbers only").

To go live:
1. `supabase db push` to apply `migrations/0001_init.sql` (tables, views, RLS).
2. Deploy `functions/verify-payment` with `PAYSTACK_SECRET_KEY` set.
3. Implement a `SupabaseBackend` against the `Backend` interface and swap it in
   `src/backend/index.ts`. Purchases must call `verify-payment` and only grant on
   `{ granted: true }`.
4. Still to write: a `finish-run` function that replays `seed + history` with the shared
   engine (it is pure TypeScript, runs in Deno) to verify endings before they count
   toward rarity, counters, invites or free Bail-Outs.

// Supabase Edge Function: verifies a Paystack transaction server-side before granting
// a Bail-Out or Clue Pass (BRIEF: "Never grant a purchase from the frontend success callback").
// Deploy: supabase functions deploy verify-payment --no-verify-jwt=false
// Secrets: PAYSTACK_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const PRICES: Record<string, { NGN: number; USD: number }> = {
  bailout: { NGN: 500_00, USD: 99 },
  clue: { NGN: 300_00, USD: 59 },
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: user } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
  if (!user?.user) return json({ granted: false, reason: 'not signed in' }, 401);

  const { reference, product, run } = await req.json();
  if (!PRICES[product] || typeof reference !== 'string') return json({ granted: false, reason: 'bad request' }, 400);

  // One grant per reference, ever.
  const { data: existing } = await supabase.from('payments').select('status').eq('paystack_ref', reference).maybeSingle();
  if (existing && existing.status !== 'pending') return json({ granted: false, reason: 'reference already used' }, 409);

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` },
  });
  const body = await res.json();
  const tx = body?.data;
  const currency = tx?.currency === 'USD' ? 'USD' : 'NGN';
  const ok = res.ok && body?.status === true && tx?.status === 'success' && tx?.amount >= PRICES[product][currency];

  // Once-per-run limits are enforced here too (Bail-Out: 1, Clue Pass: 2).
  if (ok && run) {
    const { count } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('run', run).eq('product', product).in('status', ['verified', 'consumed']);
    if ((count ?? 0) >= (product === 'bailout' ? 1 : 2)) return json({ granted: false, reason: 'limit reached for this run' }, 409);
  }

  await supabase.from('payments').upsert(
    { player: user.user.id, run, product, amount_kobo: tx?.amount ?? 0, currency, status: ok ? 'verified' : 'failed', paystack_ref: reference },
    { onConflict: 'paystack_ref' },
  );
  return json({ granted: ok, reason: ok ? undefined : 'payment not verified' }, ok ? 200 : 402);
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}

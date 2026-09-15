import { authorized } from './relay-auth.js';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const opaque = value => typeof value === 'string' && value.length >= 32 && value.length <= 65536 && /^[A-Za-z0-9+/=]+$/.test(value);

/** Relay stores ciphertext only. It cannot issue grants or decrypt client proofs. */
export function trustRelayHandler(store, env = process.env) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (env.PRIME_TRUST_ABEX_RELAY_TOKEN && env.PRIME_TRUST_ABEX_RELAY_TOKEN === env.PRIME_TRUST_VELYQUA_RELAY_TOKEN) return res.status(503).json({error:'separate_role_credentials_required'});
    if (req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
    const producer = authorized(req.headers?.authorization, env.PRIME_TRUST_VELYQUA_RELAY_TOKEN);
    const consumer = authorized(req.headers?.authorization, env.PRIME_TRUST_ABEX_RELAY_TOKEN);
    if (!producer && !consumer) return res.status(401).json({error:'unauthorized'});
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || Array.isArray(body) || JSON.stringify(body).length > 70000) throw Error();
    } catch { return res.status(422).json({error:'invalid_request'}); }
    try {
      if (body.action === 'submit' && producer) {
        if (!uuid(body.id) || !opaque(body.ciphertext) || !/^[0-9a-f]{64}$/.test(body.fingerprint || '')) return res.status(422).json({error:'invalid_request'});
        const result = await store.submit(body.id, body.ciphertext, body.fingerprint);
        return res.status(result.conflict ? 409 : 202).json(result);
      }
      if (body.action === 'result' && producer) {
        if (!uuid(body.id) || !/^[0-9a-f]{64}$/.test(body.fingerprint || '')) return res.status(422).json({error:'invalid_request'});
        const result = await store.result(body.id, body.fingerprint);
        return res.status(result ? 200 : 404).json(result || {error:'unavailable'});
      }
      if (body.action === 'claim' && consumer) return res.status(200).json({jobs:await store.claim()});
      if (body.action === 'complete' && consumer) {
        if (!uuid(body.id) || !opaque(body.ciphertext)) return res.status(422).json({error:'invalid_request'});
        return res.status(200).json(await store.complete(body.id, body.ciphertext));
      }
      return res.status(403).json({error:'operation_denied'});
    } catch {
      // Database exceptions may contain query arguments; never log credentials or ciphertext.
      return res.status(503).json({error:'relay_unavailable'});
    }
  };
}

export function postgresTrustStore(sql) {
  return {
    async submit(id, ciphertext, fingerprint) {
      const rows = await sql`insert into prime_trust_relay(id,request,fingerprint) values(${id},${ciphertext},${fingerprint}) on conflict(id) do update set id=excluded.id returning fingerprint,expires_at>now() as valid`;
      return {accepted:rows[0].fingerprint===fingerprint && rows[0].valid, conflict:rows[0].fingerprint!==fingerprint || !rows[0].valid};
    },
    async result(id, fingerprint) {
      const rows=await sql`select response,status from prime_trust_relay where id=${id} and fingerprint=${fingerprint} and expires_at>now()`;
      return rows[0] || null;
    },
    async claim() {
      await sql`delete from prime_trust_relay where id in (select id from prime_trust_relay where expires_at<now() limit 100)`;
      return sql`with selected as (select id from prime_trust_relay where response is null and deadline>now() and (leased_until is null or leased_until<now()) order by created_at limit 4 for update skip locked) update prime_trust_relay r set status='CLAIMED',leased_until=now()+interval '20 seconds' from selected where r.id=selected.id returning r.id,r.request,extract(epoch from r.deadline)::float8 as deadline`;
    },
    async complete(id,ciphertext) {
      const rows=await sql`update prime_trust_relay set response=${ciphertext},status='COMPLETED' where id=${id} and expires_at>now() and (response is null or response=${ciphertext}) returning id`;
      return {accepted:rows.length===1};
    },
  };
}

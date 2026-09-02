import { timingSafeEqual } from 'node:crypto';

export function authorized(authorization, expected = process.env.PORTFOLIO_RELAY_TOKEN) {
  const supplied = String(authorization || '').replace(/^Bearer\s+/i, '');
  const secret = String(expected || '');
  if (!supplied || !secret || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

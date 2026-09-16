import { timingSafeEqual } from 'node:crypto';

export function authorized(authorization, expected = process.env.PORTFOLIO_RELAY_TOKEN) {
  if (typeof authorization !== 'string' || typeof expected !== 'string' || !expected) return false;
  const match = /^Bearer ([A-Za-z0-9._~+\/-]+=*)$/i.exec(authorization);
  if (!match) return false;
  const supplied = Buffer.from(match[1], 'utf8');
  const secret = Buffer.from(expected, 'utf8');
  if (supplied.length !== secret.length) return false;
  return timingSafeEqual(supplied, secret);
}

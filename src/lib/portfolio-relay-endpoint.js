import { assertContract } from './generated/portfolio-contracts.js';
import { acknowledgePortfolioEvents, claimPortfolioEvents, enqueuePortfolioEvent, portfolioOutboxStatus, redrivePortfolioEvents } from './portfolio-events.js';
import { authorized } from './relay-auth.js';

export async function handlePortfolioRelay(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.PORTFOLIO_RELAY_TOKEN) return res.status(503).json({ error: 'relay_not_configured' });
  if (!authorized(req.headers?.authorization)) return res.status(401).json({ error: 'unauthorized' });
  const started = Date.now();
  try {
    if (req.method === 'GET') {
      const result = await claimPortfolioEvents({ limit: req.query?.limit, visibilitySeconds: req.query?.visibility_seconds });
      console.log(JSON.stringify({ level: 'info', message: 'portfolio_relay_claim', route: '/api/portfolio-relay', count: result.events.length, duration_ms: Date.now() - started }));
      return res.status(200).json({ ok: true, ...result });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (body.action === 'publish') {
      assertContract('portfolio-event-v1', body.event);
      const result = await enqueuePortfolioEvent(body.event);
      console.log(JSON.stringify({ level: 'info', message: 'portfolio_relay_publish', route: '/api/portfolio-relay', event_id: body.event.event_id, queued: result.queued, duration_ms: Date.now() - started }));
      return res.status(result.queued ? 202 : 503).json({ ok: result.queued, ...result });
    }
    if (body.action === 'status') {
      const result = await portfolioOutboxStatus();
      console.log(JSON.stringify({ level: 'info', message: 'portfolio_relay_status', route: '/api/portfolio-relay', ready: result.ready, duration_ms: Date.now() - started }));
      return res.status(200).json({ ok: true, ...result });
    }
    if (body.action === 'redrive') {
      const result = await redrivePortfolioEvents({ eventIds: Array.isArray(body.event_ids) ? body.event_ids : [], limit: body.limit });
      console.log(JSON.stringify({ level: 'info', message: 'portfolio_relay_redrive', route: '/api/portfolio-relay', count: result.redriven, duration_ms: Date.now() - started }));
      return res.status(200).json({ ok: true, ...result });
    }
    if (body.action === 'ack') {
      const result = await acknowledgePortfolioEvents(Array.isArray(body.event_ids) ? body.event_ids : []);
      console.log(JSON.stringify({ level: 'info', message: 'portfolio_relay_ack', route: '/api/portfolio-relay', count: result.acknowledged, duration_ms: Date.now() - started }));
      return res.status(200).json({ ok: true, ...result });
    }
    return res.status(400).json({ error: 'unsupported_action' });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'portfolio_relay_failed', route: '/api/portfolio-relay', error: String(error?.message || error), duration_ms: Date.now() - started }));
    const status = /contract|must|required|invalid/i.test(String(error?.message || error)) ? 422 : 500;
    return res.status(status).json({ error: status === 422 ? 'invalid_event' : 'relay_failed' });
  }
}

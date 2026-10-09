import { Router } from 'express';
import { Container } from '../../../shared/container';
import { authenticate } from '../../../shared/http/auth';

export function eventsRoutes(c: Container) {
  const r = Router();
  r.get('/stream', authenticate(c.tokens, c.revoked), (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    c.hub.connect(req.auth!.sub, res);
  });
  return r;
}

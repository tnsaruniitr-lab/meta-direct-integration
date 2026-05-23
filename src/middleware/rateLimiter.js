'use strict';

const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

function buildLimiter({ windowMs, max, name }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res, _next, options) {
      logger.warn({ name, ip: req.ip, path: req.originalUrl }, 'Rate limit triggered');
      res.status(options.statusCode).json({ error: 'rate_limited' });
    }
  });
}

// Reasonable defaults; tune per-route in app.js if needed.
const globalLimiter = buildLimiter({ windowMs: 60_000, max: 600, name: 'global' });

// Webhook can burst — Meta retries — but still cap to limit abuse on a public URL.
const webhookLimiter = buildLimiter({ windowMs: 60_000, max: 300, name: 'webhook' });

// Internal /send-test should be very tight.
const sendTestLimiter = buildLimiter({ windowMs: 60_000, max: 20, name: 'send-test' });

module.exports = { globalLimiter, webhookLimiter, sendTestLimiter };

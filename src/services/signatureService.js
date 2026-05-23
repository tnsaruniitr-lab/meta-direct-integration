'use strict';

const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../config/logger');

// Verifies the X-Hub-Signature-256 header Meta attaches to webhook deliveries.
// Returns true when no app secret is configured (verification disabled) or the signature matches.
function verifyMetaSignature(req) {
  if (!config.metaAppSecret) return true;

  const header = req.get('x-hub-signature-256');
  if (!header || !header.startsWith('sha256=')) {
    logger.warn('Missing or malformed X-Hub-Signature-256 header on webhook');
    return false;
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    logger.warn('Raw request body unavailable; cannot verify Meta signature');
    return false;
  }

  const expected = crypto
    .createHmac('sha256', config.metaAppSecret)
    .update(rawBody)
    .digest('hex');

  const provided = header.slice('sha256='.length);

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;

  try {
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

module.exports = { verifyMetaSignature };

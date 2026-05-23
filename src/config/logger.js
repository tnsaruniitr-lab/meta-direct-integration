'use strict';

const pino = require('pino');
const config = require('./env');

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-hub-signature-256"]',
  'headers.authorization',
  'headers.cookie',
  'headers["x-api-key"]',
  'headers["x-hub-signature-256"]',
  '*.WHATSAPP_TOKEN',
  '*.VERIFY_TOKEN',
  '*.META_APP_SECRET',
  '*.INTERNAL_API_KEY',
  '*.TELEGRAM_BOT_TOKEN',
  'WHATSAPP_TOKEN',
  'VERIFY_TOKEN',
  'META_APP_SECRET',
  'INTERNAL_API_KEY',
  'TELEGRAM_BOT_TOKEN'
];

const logger = pino({
  level: config.logLevel,
  base: {
    service: config.serviceName,
    env: config.nodeEnv,
    version: config.version
  },
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;

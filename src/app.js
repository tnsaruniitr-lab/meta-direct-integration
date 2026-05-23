'use strict';

const express = require('express');
const helmet = require('helmet');

const config = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { globalLimiter, webhookLimiter, sendTestLimiter } = require('./middleware/rateLimiter');

const healthRouter = require('./routes/health');
const whatsappWebhookRouter = require('./routes/whatsappWebhook');
const sendTestRouter = require('./routes/sendTest');

function buildApp() {
  const app = express();

  // Behind Railway's edge proxy.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(requestLogger);
  app.use(globalLimiter);

  // Preserve the raw body so we can verify Meta's HMAC signature.
  const jsonParser = express.json({
    limit: config.jsonBodyLimit,
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  });

  app.use(jsonParser);

  app.use(healthRouter);
  app.use(webhookLimiter, whatsappWebhookRouter);
  app.use(sendTestLimiter, sendTestRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { buildApp };

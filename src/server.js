'use strict';

const config = require('./config/env');
const logger = require('./config/logger');
const { buildApp } = require('./app');

const app = buildApp();

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.nodeEnv,
      hasBot: Boolean(config.botApiUrl),
      hasTelegram: Boolean(config.telegramBotToken && config.telegramChatId),
      hasMetaAppSecret: Boolean(config.metaAppSecret)
    },
    'GrowthMonk messaging adapter started'
  );
});

server.headersTimeout = 65_000;
server.keepAliveTimeout = 61_000;

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown initiated');

  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown after 15s timeout');
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during server close');
      process.exit(1);
    } else {
      logger.info('Server closed cleanly');
      process.exit(0);
    }
  });
}

['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => shutdown(sig)));

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});

module.exports = server;

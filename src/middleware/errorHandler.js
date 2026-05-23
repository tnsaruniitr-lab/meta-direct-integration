'use strict';

const logger = require('../config/logger');

function notFoundHandler(req, res, _next) {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
}

function errorHandler(err, req, res, _next) {
  const status = Number.isInteger(err.status) ? err.status : 500;
  logger.error(
    { err, path: req.originalUrl, method: req.method, status },
    'Unhandled error'
  );
  if (res.headersSent) return;
  res.status(status).json({
    error: status >= 500 ? 'internal_error' : err.code || 'request_error',
    message: status >= 500 ? 'Something went wrong' : err.publicMessage || 'Request failed'
  });
}

module.exports = { notFoundHandler, errorHandler };

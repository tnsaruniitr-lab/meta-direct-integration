'use strict';

const express = require('express');
const config = require('../config/env');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: config.serviceName,
    timestamp: new Date().toISOString(),
    version: config.version
  });
});

module.exports = router;

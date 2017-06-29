/* eslint-disable no-console */
const logger = require('winston');
const mongoose = require('mongoose');
const app = require('./app');
const port = app.get('port');
const server = app.listen(port);

const Promise = require("bluebird");

mongoose.Promise = Promise;

process.on('unhandledRejection', (reason, p) =>
  logger.error('Unhandled Rejection at: Promise ', p, reason)
);

server.on('listening', () =>
  logger.info(`Feathers application started on ${app.get('host')}:${port}`)
);

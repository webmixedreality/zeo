const http = require('http');

const express = require('express');

const archae = require('..');

const server = http.createServer();

const app = express();
app.use('/', express.static(__dirname));

const a = archae();
a.listen({server, app});

server.listen(8000);
server.on('listening', () => {
  console.log('listening');
});
server.on('error', err => {
  console.warn(err);
});

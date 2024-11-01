'use strict';

const events = require('node:events');
const hash = require('./hash.js');
const handshake = require('./handshake.js');
const validRequest = require('./validRequest.js');
const Connection = require('./connection.js');

class WebSocketServer extends events.EventEmitter {
  #connections = new Set();

  constructor(server, options) {
    super();
    server.on('upgrade', (request, socket) => {
      if (!validRequest(request)) {
        const answer = handshake.error('Invalid Request');
        return void socket.end(answer);
      }
      this.#onUpgrade(request, new Connection(socket));
    });
    server.listen(options.port, options.config);
  }

  #onUpgrade(request, connection) {
    const { headers } = request;
    const key = headers['sec-websocket-key'];
    const hashed = hash(key);
    connection.send(handshake.success(hashed), true);
    connection.on('disconnect', this.#onDisconnect.bind(this));
    this.#connections.add(connection);
    this.emit('connection', connection);
  }

  #onDisconnect(connection) {
    this.#connections.delete(connection);
  }

  get connections() {
    return new Set(this.#connections);
  }

  get connectionsCount() {
    return this.#connections.size;
  }
}

module.exports = WebSocketServer;

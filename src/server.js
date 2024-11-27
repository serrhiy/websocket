'use strict';

const events = require('node:events');
const hash = require('./hash.js');
const handshake = require('./handshake.js');
const validRequest = require('./validRequest.js');
const Connection = require('./connection.js');

class WebSocketServer extends events.EventEmitter {
  #connections = new Set();

  constructor(server, options, validator = () => true) {
    super();
    server.on('upgrade', (request, socket) => {
      const { headers } = request;
      if (!validRequest(request) || !validator(headers)) {
        const answer = handshake.error('Invalid Request');
        return void socket.end(answer);
      }
      const key = headers['sec-websocket-key'];
      const hashed = hash(key);
      socket.write(handshake.success(hashed), 'utf8', (error) => {
        if (error) return void socket.end();
        const connection = new Connection(socket);
        connection.on('disconnect', this.#onDisconnect.bind(this));
        this.#connections.add(connection);
        this.emit('connection', connection, headers);
      });
    });
    server.listen(options.port, options.host);
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

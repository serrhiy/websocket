'use strict';

module.exports = {
  success: (secretKey) =>
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${secretKey}\r\n\r\n`,
  error: (reason) =>
    'HTTP/1.1 400 Bad Request\r\n' +
    'Content-Type: text/plain\r\n' +
    `\r\n${reason}\r\n\r\n`,
};

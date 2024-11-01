'use strict';

const validators = {
  validHttpVersion: (request) => {
    const version = request.httpVersion.replaceAll('.', '');
    return Number.parseInt(version) >= 11;
  },
  validMethod: (request) => {
    const method = request.method.toLowerCase();
    return method === 'get';
  },
  validUpdateField: (request) => {
    const { upgrade } = request.headers;
    if (!upgrade) return false;
    return upgrade.includes('websocket');
  },
  validConnectionField: (request) => {
    const { connection } = request.headers;
    if (!connection) return false;
    return connection.includes('Upgrade');
  },
  validKey: (request) => 'sec-websocket-key' in request.headers,
  validWebSocketVersion: (request) =>
    request.headers['sec-websocket-version'] === '13',
  validateHostField: (request) => 'host' in request.headers,
};

module.exports = (request) => {
  for (const validator of Object.values(validators)) {
    if (!validator(request)) return false;
  }
  return true;
};

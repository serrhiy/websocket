'use strict';

const crypto = require('node:crypto');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

module.exports = (clientKey) => {
  const fullKey = clientKey + GUID;
  const hash = crypto.createHash('sha1');
  return hash.update(fullKey).digest('base64');
};

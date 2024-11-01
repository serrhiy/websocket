'use strict';

const { parser } = require('./frame/main.js');

module.exports = (socket, next) => {
  const chunks = [];
  let lastFrameLength = 0;
  let totalLength = 0;
  socket.on('data', (chunk) => {
    chunks.push(chunk);
    totalLength += chunk.length;
    if (lastFrameLength === 0) {
      const first = chunks[0];
      const arg = first.length >= 2 ? first : Buffer.concat(chunks);
      if (arg.length >= 2) lastFrameLength = parser.frameLength(arg);
    }
    if (totalLength < lastFrameLength) return;
    const total = Buffer.concat(chunks);
    const frame = total.subarray(0, lastFrameLength);
    const last = frame.readUInt8(0) & 128;
    next(last, frame);
    const rest = total.subarray(lastFrameLength);
    chunks.length = 0;
    lastFrameLength = 0;
    totalLength = 0;
    if (rest.length > 0) socket.emit('data', rest);
  });
};

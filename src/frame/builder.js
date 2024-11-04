'use strict';

const getHeaderLength = (contentLength) => {
  if (contentLength <= 125) return 2;
  if (contentLength <= 65535) return 4;
  return 10;
};

const builder = (chunk, opcode = 2) => {
  if (!Buffer.isBuffer(chunk)) return builder(Buffer.from(chunk), 1);
  const { length } = chunk;
  const headerLength = getHeaderLength(length);
  const output = Buffer.alloc(length + headerLength);
  output[0] = opcode === 2 ? 130 : 129;
  if (length <= 125) {
    output[1] = length;
    chunk.copy(output, 2);
  } else if (length <= 65535) {
    output[1] = 126;
    output.writeUInt16BE(length, 2);
    chunk.copy(output, 4);
  } else {
    output[1] = 127;
    output.writeBigUInt64BE(BigInt(length), 2);
    chunk.copy(output, 10);
  }
  return output;
};

module.exports = builder;

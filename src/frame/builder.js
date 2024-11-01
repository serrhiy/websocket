'use strict';

const getHeaderLength = (contentLength) => {
  if (contentLength <= 125) return 2;
  if (contentLength <= 65535) return 4;
  return 10;
};

const fromString = (message) => {
  const buffer = Buffer.from(message);
  const { length: contentLength } = buffer;
  const headerLength = getHeaderLength(contentLength);
  const frameLength = headerLength + contentLength;
  const output = Buffer.alloc(frameLength);
  output[0] = 129;
  if (contentLength <= 125) {
    output[1] = contentLength;
    buffer.copy(output, 2);
  } else if (contentLength <= 65535) {
    output[1] = 126;
    output.writeUInt16BE(contentLength, 2);
    buffer.copy(output, 4);
  } else {
    output[1] = 127;
    output.writeBigUInt64BE(BigInt(contentLength), 2);
    buffer.copy(output, 10);
  }
  return output;
};

module.exports = { fromString };

'use strict';

const contentLength = (chunk) => {
  const length = chunk.readUInt8(1) & 127;
  if (length <= 125) return length;
  if (length === 126) return chunk.readUInt16BE(2);
  return Number(chunk.readBigUInt64BE(2));
};

const mask = (chunk) => {
  const length = chunk.readUInt8(1) & 127;
  if (length <= 125) return chunk.subarray(2, 6);
  if (length === 126) return chunk.subarray(4, 8);
  return chunk.subarray(10, 14);
};

const content = (chunk) => {
  const length = chunk.readUInt8(1) & 127;
  if (length <= 125) return chunk.subarray(6);
  if (length === 126) return chunk.subarray(8);
  return chunk.subarray(14);
};

const frameLength = (chunk) => {
  const length = contentLength(chunk);
  if (length <= 125) return length + 2 + 4;
  if (length < 65536) return length + 2 + 4 + 2;
  return length + 2 + 4 + 8;
};

module.exports = {
  contentLength,
  mask,
  content,
  frameLength,
};

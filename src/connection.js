'use strict';

const { builder, parser } = require('./frame/main.js');
const buffer = require('node:buffer');
const getFrames = require('./getFrames.js');
const { Buffer } = buffer;
const stream = require('node:stream');
const { StringDecoder } = require('node:string_decoder');

const preparePong = (pingFrame) => {
  const content = parser.content(pingFrame);
  const output = Buffer.allocUnsafe(content.length + 2);
  output[0] = 138;
  output[1] = content.length;
  content.copy(output, 2);
  return output;
};

const prepareClose = () => Buffer.from([136, 0]); // to do

const preparePing = () => Buffer.from([137, 0]); // to do

const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

const PING_TIMEOUT = 3000;

class Connection extends stream.Duplex {
  #socket = null;
  #pingTimer = null;
  #state = OPEN;

  constructor(socket, options = {}) {
    super({ ...options, decodeStrings: false });
    socket.pause();
    this.#socket = socket;
    this.#getMessages();
  }

  writeRaw(chunk, encoding, callback) {
    if (this.#state === CLOSING) {
      callback(new Error('Socket in state \'CLOSING\''));
      return false;
    }
    return this.#socket.write(chunk, encoding, callback);
  }

  _write(chunk, encoding, callback) {
    const message = builder(chunk);
    return this.writeRaw(message, 'buffer', callback);
  }

  _read() {
    this.#socket.resume();
  }

  #getMessages() {
    const chunks = [];
    const decoder = new StringDecoder('utf-8');
    let dataType = 0;
    getFrames(this.#socket, (last, frame) => {
      const opcode = frame[0] & 15;
      const masked = frame[1] & 128;
      const rsv = frame[0] & 112;
      if (!masked || rsv !== 0) return void this.close();
      if (opcode === 8) return void this.#onClosing();
      if (opcode === 9) return void this.#onPing(frame);
      if (opcode === 10) return void this.#onPong();
      if (opcode === 1 || opcode === 2) dataType = opcode;
      else if (opcode !== 0) return void this.close();
      const content = parser.content(frame);
      const mask = parser.mask(frame);
      const message = Uint8Array.from(content, (elt, i) => elt ^ mask[i % 4]);
      if (dataType === 1 && !buffer.isUtf8(message)) return void this.close();
      const chunk = dataType === 1 ? decoder.write(message) : message;
      chunks.push(chunk);
      if (last === 0) return;
      const result = dataType === 1 ? chunks.join('') : Buffer.concat(chunks);
      chunks.length = 0;
      this.push(result);
      this.#socket.pause();
    });
  }

  #onClosing() {
    if (this.#state !== CLOSING) this.close();
    this.#state = CLOSED;
    return void this.#onEnd();
  }

  #onPong() {
    if (!this.#pingTimer) return;
    clearTimeout(this.#pingTimer);
    this.#pingTimer = null;
  }

  #onPing(frame) {
    const message = preparePong(frame);
    this.writeRaw(message);
  }

  #onEnd() {
    if (this.#pingTimer) clearTimeout(this.#pingTimer);
    this.#socket.destroy();
    this.#socket.removeAllListeners();
    this.close();
    this.emit('disconnect', this);
  }

  close() {
    const closingFrame = prepareClose();
    this.writeRaw(closingFrame);
    this.#state = CLOSING;
  }

  ping() {
    if (this.#pingTimer) return;
    const pingFrame = preparePing();
    this.writeRaw(pingFrame);
    this.#pingTimer = setTimeout(this.#onEnd.bind(this), PING_TIMEOUT);
  }
}

module.exports = Connection;

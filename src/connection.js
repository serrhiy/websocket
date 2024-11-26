'use strict';

const { builder, parser } = require('./frame/main.js');
const buffer = require('node:buffer');
const getFrames = require('./getFrames.js');
const { Buffer } = buffer;
const stream = require('node:stream');
const { StringDecoder } = require('node:string_decoder');
const AsyncQueue = require('./AsyncQueue.js');

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
const PING_SENDING_INTERVAL = 5000;

class Connection extends stream.Duplex {
  #socket = null;
  #pingTimeoutTimer = null;
  #pingTimer = null;
  #state = OPEN;
  #messages = new AsyncQueue();

  constructor(socket, options = {}) {
    super({ ...options, decodeStrings: false });
    this.#socket = socket;
    this.#getMessages();
    this.#startAutoPing();
  }

  writeRaw(chunk, encoding, callback) {
    if (this.#state === CLOSING) {
      callback(new Error("Socket in state 'CLOSING'"));
      return false;
    }
    return this.#socket.write(chunk, encoding, callback);
  }

  _write(chunk, encoding, callback) {
    const message = builder(chunk);
    return this.writeRaw(message, 'buffer', callback);
  }

  _read() {
    this.#messages.get().then((message) => void this.push(message));
  }

  #getMessages() {
    const chunks = [];
    const decoder = new StringDecoder('utf-8');
    let dataType = 0;
    getFrames(this.#socket, (last, frame) => {
      this.#startAutoPing();
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
      this.#messages.add(result);
    });
  }

  #startAutoPing() {
    if (this.#pingTimer) clearTimeout(this.#pingTimer);
    this.#pingTimer = setTimeout(this.ping.bind(this), PING_SENDING_INTERVAL);
  }

  #onClosing() {
    if (this.#state !== CLOSING) this.close();
    this.#state = CLOSED;
    return void this.#onEnd();
  }

  #onPong() {
    if (!this.#pingTimeoutTimer) return;
    clearTimeout(this.#pingTimeoutTimer);
    this.#pingTimeoutTimer = null;
  }

  #onPing(frame) {
    const message = preparePong(frame);
    this.writeRaw(message);
  }

  #onEnd() {
    if (this.#pingTimeoutTimer) clearTimeout(this.#pingTimeoutTimer);
    if (this.#pingTimer) clearTimeout(this.#pingTimer);
    this.#socket.destroy();
    this.#socket.removeAllListeners();
    this.emit('disconnect', this);
  }

  close() {
    const closingFrame = prepareClose();
    const { promise, resolve, reject } = Promise.withResolvers();
    this.writeRaw(closingFrame, 'buffer', (error) => {
      if (error) {
        this.#onEnd();
        return void reject(error);
      }
      this.#state = CLOSING;
      resolve();
    });
    return promise;
  }

  ping() {
    const { promise, resolve, reject } = Promise.withResolvers();
    if (this.#pingTimer) clearTimeout(this.#pingTimer);
    if (this.#pingTimeoutTimer) return void resolve();
    const pingFrame = preparePing();
    this.writeRaw(pingFrame, 'buffer', (error) => {
      if (error) {
        this.#onEnd();
        return void reject(error);
      }
      this.#pingTimeoutTimer = setTimeout(() => {
        this.#onEnd();
      }, PING_TIMEOUT);
      resolve();
    });
    return promise;
  }
}

module.exports = Connection;

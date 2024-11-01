'use strict';

const events = require('node:events');
const { builder, parser } = require('./frame/main.js');
const buffer = require('node:buffer');
const getFrames = require('./getFrames.js');
const { Buffer } = buffer;

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

const OPEN = 0;
const CLOSING = 1;
const CLOSED = 2;

const PING_TIMEOUT = 3000;

class Connection extends events.EventEmitter {
  #socket = null;
  #state = OPEN;
  #pingTimer = null;

  constructor(socket) {
    super();
    this.#socket = socket;
    this.#getMessages();
    socket.on('end', this.#onEnd.bind(this));
  }

  #getMessages() {
    const chunks = [];
    const decoder = new TextDecoder();
    let dataType = -1;
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
      const chunk = dataType === 1 ? decoder.decode(message) : message;
      chunks.push(chunk);
      if (last === 0) return;
      const result = dataType === 1 ? chunks.join('') : Buffer.concat(chunks);
      chunks.length = 0;
      this.emit('message', result);
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
    this.send(message, true);
  }

  #onEnd() {
    if (this.#pingTimer) clearTimeout(this.#pingTimer);
    this.#socket.destroy();
    this.#socket.removeAllListeners();
    this.emit('disconnect', this);
  }

  #write(data) {
    return new Promise((resolve, reject) => {
      this.#socket.write(data, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  send(data, raw = false) {
    if (this.#state === CLOSING) return Promise.resolve();
    if (raw) return this.#write(data);
    if (typeof data === 'string') {
      const message = builder.fromString(data);
      return this.#write(message);
    }
  }

  close() {
    const closingFrame = prepareClose();
    this.send(closingFrame, true);
    this.#state = CLOSING;
  }

  ping() {
    if (this.#pingTimer) return;
    const pingFrame = preparePing();
    this.send(pingFrame, true);
    this.#pingTimer = setTimeout(this.#onEnd.bind(this), PING_TIMEOUT);
  }
}

module.exports = Connection;

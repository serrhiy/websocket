'use strict';

class AsyncQueue {
  #items = [];
  #resolves = [];

  add(item) {
    const resolves = this.#resolves;
    if (resolves.length > 0) {
      const resolve = resolves.shift();
      return void resolve(item);
    }
    this.#items.push(item);
  }

  get() {
    return new Promise((resolve) => {
      const items = this.#items;
      if (items.length > 0) resolve(items.shift());
      this.#resolves.push(resolve);
    });
  }
}

module.exports = AsyncQueue;

/**
 * @module EventEmitter
 * Minimal event emitter for the overlay library.
 * Provides on/off/once/emit semantics — no framework dependency.
 */
export class EventEmitter {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name (e.g. 'feature:select')
   * @param {Function} callback - Listener function
   * @returns {this} For chaining
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return this;
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event - Event name
   * @param {Function} callback - The exact function reference passed to `on()`
   * @returns {this} For chaining
   */
  off(event, callback) {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this._listeners.delete(event);
      }
    }
    return this;
  }

  /**
   * Subscribe to an event once — automatically removed after first invocation.
   * @param {string} event - Event name
   * @param {Function} callback - Listener function
   * @returns {this} For chaining
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback.apply(this, args);
    };
    // Store reference so `off(event, callback)` can also remove it
    wrapper._originalCallback = callback;
    return this.on(event, wrapper);
  }

  /**
   * Emit an event, calling all registered listeners with the provided arguments.
   * @param {string} event - Event name
   * @param {...*} args - Arguments forwarded to listeners
   * @returns {this} For chaining
   */
  emit(event, ...args) {
    const set = this._listeners.get(event);
    if (set) {
      // Iterate a snapshot so listeners can safely remove themselves
      for (const cb of [...set]) {
        cb.apply(this, args);
      }
    }
    return this;
  }

  /**
   * Remove all listeners, optionally for a specific event.
   * @param {string} [event] - If provided, only clears listeners for that event
   * @returns {this} For chaining
   */
  removeAllListeners(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }
}

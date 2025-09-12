/**
 * Logging utility for consistent logging across modules
 */
export class Logger {
  /**
   * @param {Object} [options={}] - Logger configuration
   * @param {boolean} [options.enableLogging=false] - Enable/disable logging
   * @param {string} [options.prefix=''] - Prefix for log messages
   */
  constructor(options = {}) {
    this.options = {
      enableLogging: false,
      prefix: '',
      ...options,
    };
  }

  /**
   * Log a message with the configured prefix
   * @param {string} message - Message to log
   */
  log(message) {
    if (this.options.enableLogging) {
      const prefixedMessage = this.options.prefix
        ? `[${this.options.prefix}] ${message}`
        : message;
      console.log(prefixedMessage);
    }
  }

  /**
   * Start a timer with a label
   * @param {string} label - Timer label
   */
  time(label) {
    if (this.options.enableLogging) {
      const prefixedLabel = this.options.prefix
        ? `[${this.options.prefix}] ${label}`
        : label;
      console.time(prefixedLabel);
    }
  }

  /**
   * End a timer with a label
   * @param {string} label - Timer label (must match the start label)
   */
  timeEnd(label) {
    if (this.options.enableLogging) {
      const prefixedLabel = this.options.prefix
        ? `[${this.options.prefix}] ${label}`
        : label;
      console.timeEnd(prefixedLabel);
    }
  }

  /**
   * Update logger options
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Create a child logger with a different prefix
   * @param {string} childPrefix - Prefix for the child logger
   * @returns {Logger} New logger instance
   */
  createChild(childPrefix) {
    return new Logger({
      ...this.options,
      prefix: childPrefix,
    });
  }
}

/**
 * Create a logger instance with a specific prefix
 * @param {string} prefix - Prefix for log messages
 * @param {Object} [options={}] - Additional logger options
 * @returns {Logger} Logger instance
 */
export function createLogger(prefix, options = {}) {
  return new Logger({
    prefix,
    ...options,
  });
}

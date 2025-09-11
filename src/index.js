/**
 * Main entry point for the searoutes module
 * @author Your Name
 * @version 1.0.0
 */

/**
 * A sample function that demonstrates ES6 module functionality
 * @param {string} name - The name to greet
 * @returns {string} A greeting message
 * @throws {Error} If name is not a string
 */
export const greet = (name) => {
  if (typeof name !== 'string') {
    throw new Error('Name must be a string');
  }
  return `Hello, ${name}! Welcome to searoutes.`;
};

/**
 * Route information object
 * @typedef {Object} RouteInfo
 * @property {string} from - Starting point
 * @property {string} to - Destination point
 * @property {number} distance - Distance in nautical miles
 * @property {string} description - Human-readable route description
 */

/**
 * A sample class demonstrating ES6 class syntax
 */
export class SeaRoute {
  /**
   * Creates a new SeaRoute instance
   * @param {string} from - Starting point
   * @param {string} to - Destination point
   * @param {number} [distance=0] - Distance in nautical miles
   */
  constructor(from, to, distance = 0) {
    /** @type {string} */
    this.from = from;
    /** @type {string} */
    this.to = to;
    /** @type {number} */
    this.distance = distance;
  }

  /**
   * Get route information
   * @returns {RouteInfo} Route details
   */
  getRouteInfo() {
    return {
      from: this.from,
      to: this.to,
      distance: this.distance,
      description: `Route from ${this.from} to ${this.to}`
    };
  }

  /**
   * Calculate estimated time based on average speed
   * @param {number} [speed=10] - Speed in knots
   * @returns {number} Estimated time in hours
   * @throws {Error} If speed is not positive
   */
  calculateTime(speed = 10) {
    if (speed <= 0) {
      throw new Error('Speed must be positive');
    }
    return this.distance / speed;
  }
}

/**
 * Module exports object
 * @typedef {Object} SearchRoutesModule
 * @property {typeof greet} greet - The greet function
 * @property {typeof SeaRoute} SeaRoute - The SeaRoute class
 * @property {string} version - Module version
 */

/**
 * Default export - main module functionality
 * @type {SearchRoutesModule}
 */
export default {
  greet,
  SeaRoute,
  version: '1.0.0'
};

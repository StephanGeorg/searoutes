import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PathFinderLib = require('geojson-path-finder');
const PathFinder = PathFinderLib.default;
const splitGeoJSON = require('geojson-antimeridian-cut');

import { point, lineString } from '@turf/helpers';

/**
 * SeaRoutes - Maritime route calculation library
 * Provides shortest path calculations for maritime routes with support for vessel-specific restrictions
 * @author Stephan Georg
 * @version 1.0.0
 */

import { haversine, triplicateGeoJSON, unwrapPath, normalizePair } from './utils/geo.js';
import { computeEffectiveStatusNoOverrides, collectClassEdgeRules, makeWeightFn } from './utils/profiles.js';
import { CoordinateLookup } from './core/CoordinateLookup.js';
import { createLogger } from './utils/logger.js';

/**
 * Maritime route calculation and pathfinding class
 * Provides shortest path calculations for maritime routes with support for vessel-specific restrictions
 *
 * @property {Object} network - GeoJSON network data
 * @property {Object} maritimeProfiles - Maritime passage rules configuration
 * @property {Object} options - Configuration options
 * @property {CoordinateLookup} coordinateLookup - Coordinate lookup and snapping system
 * @property {Object} tripled - Triplicated GeoJSON for antimeridian handling
 * @property {Map} pathfinders - Map of profile names to PathFinder instances
 * @property {Object} logger - Logger instance for performance monitoring
 */
export class SeaRoute {
  /**
   * Creates a new SeaRoute instance
   * @param {Object} network - GeoJSON network data
   * @param {Object} [maritimeProfiles] - Maritime passage rules (optional)
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.tolerance=1e-4] - Pathfinding tolerance
   * @param {number} [options.restrictedMultiplier=1.25] - Weight multiplier for restricted passages
   * @param {boolean} [options.enableLogging=true] - Enable performance logging
   */
  constructor(network, maritimeProfiles = null, options = {}) {
    this.network = network;
    this.maritimeProfiles = maritimeProfiles;
    this.options = {
      tolerance: 1e-4,
      restrictedMultiplier: 1.25,
      enableLogging: true,
      ...options,
    };

    // Core infrastructure - now using unified coordinate lookup
    this.coordinateLookup = null;
    this.tripled = null;

    // Pathfinding systems
    this.pathfinders = new Map();

    // Initialize logger
    this.logger = createLogger('SeaRoute', {
      enableLogging: this.options.enableLogging,
    });

    this.init();
  }

  /**
   * Initialize the SeaRoute instance
   * @private
   * @throws {Error} If initialization fails
   */
  init() {
    try {
      this.buildNetworkInfrastructure();
      this.createDefaultPathfinder();

      if (this.maritimeProfiles) {
        this.createMaritimePathfinders();
      }

      this.logger.log('SeaRoute initialization completed successfully');
    } catch (error) {
      throw new Error(`Failed to initialize SeaRoute: ${error.message}`);
    }
  }

  /**
   * Build the core network infrastructure including coordinate lookup and GeoJSON triplication
   * @private
   */
  buildNetworkInfrastructure() {
    this.logger.log('Building network infrastructure...');

    this.coordinateLookup = new CoordinateLookup(this.network, {
      enableLogging: this.options.enableLogging,
    });

    this.logger.time('Triplicating GeoJSON');
    this.tripled = triplicateGeoJSON(this.network);
    this.logger.timeEnd('Triplicating GeoJSON');
  }

  /**
   * Create the default pathfinder for basic routing without vessel restrictions
   * @private
   */
  createDefaultPathfinder() {
    this.logger.log('Creating default pathfinder...');
    this.logger.time('Default pathfinder');

    const defaultPathfinder = new PathFinder(this.tripled, {
      tolerance: this.options.tolerance,
      weight: (a, b) => Math.trunc(haversine(a, b)),
    });

    this.pathfinders.set('default', defaultPathfinder);
    this.logger.timeEnd('Default pathfinder');
  }

  /**
   * Create maritime pathfinders for vessel-specific routing with passage restrictions
   * @private
   */
  createMaritimePathfinders() {
    this.logger.log('Creating maritime pathfinders...');
    this.logger.time('Maritime pathfinders');

    const maritimeResult = this.buildMaritimePathfinders(
      this.maritimeProfiles,
      this.tripled,
      { triplicateGeoJSON, haversine },
      {
        triplicate: false,
        restrictedMultiplier: this.options.restrictedMultiplier,
        tolerance: this.options.tolerance,
      },
    );

    // Maritime Pathfinder zur Map hinzufügen
    for (const [profileName, pathfinder] of Object.entries(maritimeResult.pathFinders)) {
      this.pathfinders.set(profileName, pathfinder);
    }

    this.logger.timeEnd('Maritime pathfinders');
  }

  /**
   * Build one PathFinder per vessel class from a maritime config and a base routes GeoJSON.
   * @private
   * @param {Object} maritimeConfig - Maritime configuration with classes and passages
   * @param {Object} baseGeoJSON - Base GeoJSON network
   * @param {Object} helpers - Helper functions object
   * @param {Function} helpers.triplicateGeoJSON - Function to triplicate GeoJSON
   * @param {Function} helpers.haversine - Distance calculation function
   * @param {Object} [options={}] - Build options
   * @param {number} [options.restrictedMultiplier=1.25] - Weight multiplier for restricted passages
   * @param {number} [options.tolerance] - Pathfinding tolerance
   * @param {boolean} [options.triplicate=false] - Whether to triplicate the graph
   * @returns {Object} Object containing pathFinders, weights, rules, and effectiveStatus
   * @throws {Error} If maritimeConfig.classes is empty
   */
  buildMaritimePathfinders(
    maritimeConfig = {},
    baseGeoJSON,
    helpers, // { triplicateGeoJSON, haversine }
    options = {},
  ) {
    const {
      restrictedMultiplier = 1.25,
      tolerance,
      triplicate = false,
    } = options;

    const classes = Object.keys(maritimeConfig.classes || {});
    if (classes.length === 0) {
      throw new Error('maritimeConfig.classes is empty. Add at least one vessel class.');
    }

    const effective = computeEffectiveStatusNoOverrides(maritimeConfig, classes);
    const rules = collectClassEdgeRules(effective, classes);

    const weights = {};
    for (const clazz of classes) {
      weights[clazz] = makeWeightFn(clazz, rules, restrictedMultiplier, helpers.haversine);
    }

    const graph = triplicate ? helpers.triplicateGeoJSON(baseGeoJSON) : baseGeoJSON;

    const pathFinders = {};
    for (const clazz of classes) {
      pathFinders[clazz] = new PathFinder(graph, {
        weight: weights[clazz],
        ...(typeof tolerance === 'number' ? { tolerance } : {}),
      });
    }

    return {
      pathFinders,
      weights,
      rules,
      effectiveStatus: effective,
    };
  }

  /**
   * Get a specific pathfinder instance
   * @param {string} [profileName='default'] - Profile name
   * @returns {Object} PathFinder instance
   * @throws {Error} If profile doesn't exist
   */
  getPathFinder(profileName = 'default') {
    if (!this.pathfinders.has(profileName)) {
      const available = Array.from(this.pathfinders.keys()).join(', ');
      throw new Error(
        `Profile '${profileName}' not found. Available profiles: ${available}`,
      );
    }
    return this.pathfinders.get(profileName);
  }

  /**
   * Get the shortest path between two points
   * @param {Object} startPoint - GeoJSON point feature
   * @param {Object} startPoint.geometry - Point geometry
   * @param {number[]} startPoint.geometry.coordinates - [longitude, latitude]
   * @param {Object} endPoint - GeoJSON point feature
   * @param {Object} endPoint.geometry - Point geometry
   * @param {number[]} endPoint.geometry.coordinates - [longitude, latitude]
   * @param {Object} [options={}] - Path calculation options
   * @param {string} [options.profile='default'] - Profile to use for routing
   * @param {boolean} [options.path=false] - Include geometry in result
   * @returns {Object|null} Path result with distance and optional geometry, or null if no path found
   * @returns {number} returns.weight - Path weight in meters
   * @returns {number} returns.distance - Distance in kilometers
   * @returns {number} returns.distanceNM - Distance in nautical miles
   * @returns {string} returns.profile - Profile used for calculation
   * @returns {Object} [returns.path] - Path geometry (if options.path=true)
   */
  getShortestPath(startPoint = {}, endPoint = {}, options = {}) {
    const { path = false, profile = 'default' } = options;
    const start = startPoint?.geometry?.coordinates;
    const end = endPoint?.geometry?.coordinates;
    const [A, B] = normalizePair(start, end);

    // Turn A and B into geojson with turf.point
    const AasGeoJSON = point(A);
    const BasGeoJSON = point(B);

    // Use specified profile pathfinder
    const pathfinder = this.getPathFinder(profile);
    const res = pathfinder.findPath(AasGeoJSON, BasGeoJSON);

    if (!res) return null;

    return {
      ...res,
      profile, // Include which profile was used
      path: path === true ? splitGeoJSON(lineString(unwrapPath(res.path))) : undefined,
      distance: res.weight / 1000,
      distanceNM: Math.round(((res.weight / 1000) * 0.539957) * 100) / 100,
    };
  }

  /**
   * Get shortest route between two points snapped to network
   * @param {number[]} startPoint - Start coordinates [longitude, latitude]
   * @param {number[]} endPoint - End coordinates [longitude, latitude]
   * @param {Object} [options={}] - Route calculation options
   * @param {string} [options.profile='default'] - Profile to use for routing
   * @param {boolean} [options.path=false] - Include geometry in result
   * @returns {Object|null} Route result with same structure as getShortestPath, or null if no route found
   * @throws {Error} If unable to snap points to network
   */
  getShortestRoute(startPoint = [], endPoint = [], options = {}) {
    const start = point(startPoint);
    const end = point(endPoint);

    // Snap coords to network
    const startPointSnapped = this.coordinateLookup.snapToNearestVertex(start);
    const endPointSnapped = this.coordinateLookup.snapToNearestVertex(end);

    if (!startPointSnapped || !endPointSnapped) {
      throw new Error('Unable to snap points to network');
    }

    // Get shortest path from network using specified or default profile
    const shortestPath = this.getShortestPath(
      startPointSnapped,
      endPointSnapped,
      options,
    );

    return shortestPath;
  }
}

/**
 * Module exports object
 * @typedef {Object} SeaRoutesModule
 * @property {typeof SeaRoute} SeaRoute - The SeaRoute class constructor
 * @property {string} version - Module version string
 */

/**
 * Default export - main module functionality
 * @type {SeaRoutesModule}
 */
export default {
  SeaRoute,
  version: '1.0.0',
};

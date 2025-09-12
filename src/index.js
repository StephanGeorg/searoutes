import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PathFinderLib = require('geojson-path-finder');
const PathFinder = PathFinderLib.default;

import { point, lineString } from '@turf/helpers';
import splitGeoJSON from 'geojson-antimeridian-cut';

/**
 * Main entry point for the searoutes module
 * @author Stephan Georg
 * @version 1.0.0
 */

import { haversine, triplicateGeoJSON, unwrapPath, normalizePair } from './utils/geo.js';
import { computeEffectiveStatusNoOverrides, collectClassEdgeRules, makeWeightFn } from './utils/profiles.js';
import { CoordinateLookup } from './core/CoordinateLookup.js';

/**
 * A sample class demonstrating ES6 class syntax
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
    this.availableProfiles = [];

    this.init();
  }

  init() {
    try {
      // 1. Grundlegende Netzwerk-Infrastruktur aufbauen
      this.buildNetworkInfrastructure();

      // 2. Standard-Pathfinder erstellen (immer verfügbar)
      this.createDefaultPathfinder();

      // 3. Maritime Profile-Pathfinder erstellen (falls konfiguriert)
      if (this.maritimeProfiles) {
        this.createMaritimePathfinders();
      }

      this.log('SeaRoute initialization completed successfully');
    } catch (error) {
      throw new Error(`Failed to initialize SeaRoute: ${error.message}`);
    }
  }

  buildNetworkInfrastructure() {
    this.log('Building network infrastructure...');

    // Initialize unified coordinate lookup system
    this.coordinateLookup = new CoordinateLookup({
      enableLogging: this.options.enableLogging,
    });

    // Build spatial index for coordinate operations
    this.coordinateLookup.buildIndex(this.network);

    // GeoJSON triplizieren für Antimeridian-Handling
    this.time('Triplicating GeoJSON');
    this.tripled = triplicateGeoJSON(this.network);
    this.timeEnd('Triplicating GeoJSON');
  }

  createDefaultPathfinder() {
    this.log('Creating default pathfinder...');
    this.time('Default pathfinder');

    const defaultPathfinder = new PathFinder(this.tripled, {
      tolerance: this.options.tolerance,
      weight: (a, b) => Math.trunc(haversine(a, b)),
    });

    this.pathfinders.set('default', defaultPathfinder);
    this.availableProfiles.push('default');

    this.timeEnd('Default pathfinder');
  }

  createMaritimePathfinders() {
    this.log('Creating maritime pathfinders...');
    this.time('Maritime pathfinders');

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
      this.availableProfiles.push(profileName);
    }

    this.timeEnd('Maritime pathfinders');
    this.log(`Maritime profiles available: ${this.getMaritimeProfiles().join(', ')}`);
  }

  /**
 * Build one PathFinder per vessel class from a maritime config and a base routes GeoJSON.
 * - Classes are discovered dynamically from maritimeConfig.classes keys.
 * - NO overrides support.
 * - Uses default_policy when a passage lacks a class-specific status.
 *
 * @param {object} maritimeConfig  // { default_policy, classes:{...}, passages:{...} }
 * @param {object} baseGeoJSON
 * @param {{ triplicateGeoJSON:Function, haversine:Function }} helpers
 * @param {{ restrictedMultiplier?: number, tolerance?: number, triplicate?: boolean }} options
 * @returns {{
 *   pathFinders: Record<string, any>,
 *   weights: Record<string, Function>,
 *   rules: Record<string, {forbidden:Set<number>, restricted:Set<number>}>,
 *   effectiveStatus: Record<string, {status: Record<string,string>, feature_ids:number[]}>
 * }}
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

    // 1) Effective status = base config only (no overrides)
    const effective = computeEffectiveStatusNoOverrides(maritimeConfig, classes);

    // 2) Edge rules by class
    const rules = collectClassEdgeRules(effective, classes);

    // 3) Weight functions per class
    const weights = {};
    for (const clazz of classes) {
      weights[clazz] = makeWeightFn(clazz, rules, restrictedMultiplier, helpers.haversine);
    }

    // 4) Graph (optionally triplicate upstream)
    const graph = triplicate ? helpers.triplicateGeoJSON(baseGeoJSON) : baseGeoJSON;

    // 5) PathFinders per class
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
   * Get available pathfinder profiles
   * @returns {string[]} List of available profile names
   */
  getAvailableProfiles() {
    return [...this.availableProfiles];
  }

  /**
   * Get maritime profiles only (excludes default)
   * @returns {string[]} List of maritime profile names
   */
  getMaritimeProfiles() {
    return this.availableProfiles.filter(profile => profile !== 'default');
  }

  /**
   * Check if a profile exists
   * @param {string} profileName - Profile name to check
   * @returns {boolean} True if profile exists
   */
  hasProfile(profileName) {
    return this.pathfinders.has(profileName);
  }

  /**
   * Get a specific pathfinder instance
   * @param {string} [profileName='default'] - Profile name
   * @returns {Object} PathFinder instance
   * @throws {Error} If profile doesn't exist
   */
  getPathFinder(profileName = 'default') {
    if (!this.pathfinders.has(profileName)) {
      throw new Error(
        `Profile '${profileName}' not found. Available profiles: ${this.availableProfiles.join(', ')}`,
      );
    }
    return this.pathfinders.get(profileName);
  }

  /**
   * Get pathfinder based on options (backward compatibility)
   * @param {Object} [options={}] - Options with optional profile
   * @returns {Object} PathFinder instance
   */
  getPathFinderFromOptions(options = {}) {
    const profileName = options.profile || 'default';
    return this.getPathFinder(profileName);
  }

  /**
   * Get the shortest path between two points
   * @param {Object} startPoint - GeoJSON point
   * @param {Object} endPoint - GeoJSON point
   * @param {Object} [options={}] - Path options
   * @param {string} [options.profile='default'] - Profile to use
   * @param {boolean} [options.path=false] - Include geometry in result
   * @returns {Object|null} Path result with distance and optional geometry
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
   * @param {number[]} startPoint - [longitude, latitude]
   * @param {number[]} endPoint - [longitude, latitude]
   * @param {Object} [options={}] - Route options
   * @param {string} [options.profile='default'] - Profile to use
   * @param {boolean} [options.path=false] - Include geometry in result
   * @returns {Object|null} Route result
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

  // Utility methods for logging and timing
  log(message) {
    if (this.options.enableLogging) {
      console.log(`[SeaRoute] ${message}`);
    }
  }

  time(label) {
    if (this.options.enableLogging) {
      console.time(`[SeaRoute] ${label}`);
    }
  }

  timeEnd(label) {
    if (this.options.enableLogging) {
      console.timeEnd(`[SeaRoute] ${label}`);
    }
  }
}

/**
 * Module exports object
 * @typedef {Object} SearchRoutesModule
 * @property {typeof SeaRoute} SeaRoute - The SeaRoute class
 * @property {string} version - Module version
 */

/**
 * Default export - main module functionality
 * @type {SearchRoutesModule}
 */
export default {
  SeaRoute,
  version: '1.0.0',
};

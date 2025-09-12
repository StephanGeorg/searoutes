import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PathFinderLib = require('geojson-path-finder');
const PathFinder = PathFinderLib.default;

import Flatbush from 'flatbush';
import { coordAll } from '@turf/meta';
import { point, lineString } from '@turf/helpers';
import splitGeoJSON from 'geojson-antimeridian-cut';

/**
 * Main entry point for the searoutes module
 * @author Stephan Georg
 * @version 1.0.0
 */

import { haversine, triplicateGeoJSON, unwrapPath, normalizePair } from './utils/geo.js';
import { computeEffectiveStatusNoOverrides, collectClassEdgeRules, makeWeightFn } from './utils/profiles.js';



// import maritimeConfig from '../../data/maritime_passage_rules_v1.json';

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
   * @param {Object} network - GeoJSON network data
   * @param {Object} profiles - Maritime passage rules
   * @param {Object} [params={}] - Route parameters
   * @param {string} [params.from] - Starting point
   * @param {string} [params.to] - Destination point
   * @param {number} [params.distance] - Distance in nautical miles
   */
  constructor(network, profiles, params = {}) {
    /** @type {Object} */
    this.network = network;
    /** @type {Object} */
    this.profiles = profiles;
    /** @type {Object} */
    this.params = params;

    this.vertices = null;
    this.index = null;
    this.pathFinder = null;
    this.tripled = null;
    this.pathFinders = null;

    this.init();
  }

  init() {
    // Load vertices from routes
    console.time('Indexing vertices data');
    this.vertices = coordAll(this.network).map((coords) => coords);
    this.index = new Flatbush(this.vertices.length);
    this.vertices.forEach((vertex) => {
      this.index.add(vertex[0], vertex[1], vertex[0], vertex[1]);
    });
    this.index.finish();
    console.timeEnd('Indexing vertices data');

    console.time('Triplicating GeoJSON');
    this.tripled = triplicateGeoJSON(this.network);
    console.timeEnd('Triplicating GeoJSON');

    console.time('Generating path');
    // Standard pathfinder with haversine weight
    this.pathFinder = new PathFinder(this.tripled, {
      tolerance: 1e-4, // Custom tolerance
      // weight: (a, b, edgeData) => this.customWeight(a, b, edgeData), // Custom weight function
      weight: (a, b) => Math.trunc(haversine(a, b)), // Standard haversine weight
      // edgeDataReducer: (a, b, p) => this.customEdgeReducer(a, b, p), // Custom edge data reducer
      // edgeDataSeed: (a, b, p) => this.customEdgeDataSeed(a, b, p), // Custom edge data seed
    });
    console.timeEnd('Generating path');

    console.time('Building maritime pathfinders');
    const maritimePathfinders = this.buildMaritimePathfinders(
      this.profiles,
      this.tripled,
      { triplicateGeoJSON, haversine },
      { triplicate: false, restrictedMultiplier: 1 },
    );
    this.pathFinders = maritimePathfinders.pathFinders;

    console.timeEnd('Building maritime pathfinders');
    console.log('Maritime pathfinders built:', Object.keys(this.pathFinders));
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
   * Get the pathfinder instance
   * @param {*} options Query options
   * @returns object
   */
  getPathFinder(options = {}) {
    const { profile } = options;
    if (profile) {
      if (!this.pathFinders[profile]) {
        throw new Error(`Profile '${profile}' not found.`);
      }
      return this.pathFinders[profile];
    }
    return this.pathFinder;
  }

  getVertices() {
    return this.vertices;
  }

  getVertex(id) {
    if (!id) return null;
    return this.getVertices()[id];
  }

  /**
   * Snap a point to nearest vertex of the network
   * @param {object} point
   * @returns {object}
   */
  snapPointToVertex(pointToSnap = {}) {
    if (!pointToSnap) return null;
    const neighborId = this.index.neighbors(
      pointToSnap?.geometry?.coordinates[0],
      pointToSnap?.geometry?.coordinates[1],
      1,
    );
    return point(this.getVertex(neighborId[0]));
  }

  /**
   * Get the shortest path between two points
   * @param {object} startPoint
   * @param {object} endPoint
   * @returns
   */
  getShortestPath(startPoint = {}, endPoint = {}, options = {}) {
    const { path = false } = options;
    const start = startPoint?.geometry?.coordinates;
    const end = endPoint?.geometry?.coordinates;
    const [A, B] = normalizePair(start, end);

    // Turn A and B into geojson with turf.point
    const AasGeoJSON = point(A);
    const BasGeoJSON = point(B);

    const res = this.getPathFinder(options).findPath(AasGeoJSON, BasGeoJSON);

    return res
      ? {
        ...res,
        path: path === true ? splitGeoJSON(lineString(unwrapPath(res.path))) : undefined,
        distance: res.weight / 1000,
        distanceNM: Math.round(((res.weight / 1000) * 0.539957) * 100) / 100,
      } : null;
  }

  /**
   * Get shortest route between two points snapped to network
   * @param {*} startPoint
   * @param {*} endPoint
   * @returns
   */
  getShortestRoute(startPoint = [], endPoint = [], options = {}) {
    const start = point(startPoint);
    const end = point(endPoint);

    // Snap coords to network
    const startPointSnapped = this.snapPointToVertex(start);
    const endPointSnapped = this.snapPointToVertex(end);

    if (!startPointSnapped || !endPointSnapped) throw new Error('Point missing');

    // Get shortest path from network
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
  version: '1.0.0',
};

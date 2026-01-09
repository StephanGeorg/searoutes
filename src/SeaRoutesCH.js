/**
 * SeaRoutesCH - Contraction Hierarchy based maritime routing
 *
 * This class provides access to pre-built Contraction Hierarchy graphs
 * for efficient maritime pathfinding without graph generation.
 *
 * @author Stephan Georg
 * @version 2.0.0
 * @since 2025-12-29
 */

import { Graph, CoordinateLookup } from 'contraction-hierarchy-js';
import { coordEach } from '@turf/meta';
import { lineString } from '@turf/helpers';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';

// Handle CommonJS modules in ES6 environment
const require = createRequire(import.meta.url);
const splitGeoJSON = require('geojson-antimeridian-cut');

// Import utility functions
import { unwrapPath, normalizePair } from './utils/geo.js';

/**
 * SeaRoutesCH - Maritime routing using Contraction Hierarchy graphs
 *
 * Provides efficient pathfinding using pre-built Contraction Hierarchy graphs.
 * Graphs must be generated using the generate-graph scripts before use.
 */
export class SeaRouteCH {
  /**
   * Create a new SeaRouteCH instance
   *
   * @param {Object} options - Configuration options
   * @param {string} options.graphPath - Path to the PBF graph file (optional)
   * @param {string} options.graphName - Name of the default graph to load (optional)
   * @param {string} options.profile - Profile name for default graph (optional)
   */
  constructor(options = {}) {
    this.graph = null;
    this.finder = null;
    this.lookup = null;
    this.loadedGraph = null;

    // Auto-load graph if specified
    if (options.graphPath) {
      this.loadGraph(options.graphPath);
    } else if (options.graphName) {
      this.loadDefaultGraph(options.graphName, options.profile);
    }
  }

  /**
   * Load a Contraction Hierarchy graph from PBF file
   *
   * @param {string|Buffer} graphPath - Path to PBF file or Buffer containing graph data
   * @param {Object} pathfinderOptions - Options for pathfinder creation
   * @returns {SeaRouteCH} This instance for method chaining
   * @throws {Error} If graph loading fails
   */
  loadGraph(graphPath, pathfinderOptions = {}) {
    try {
      let buffer;

      if (Buffer.isBuffer(graphPath)) {
        buffer = graphPath;
        this.loadedGraph = 'buffer';
      } else {
        if (!existsSync(graphPath)) {
          throw new Error(`Graph file not found: ${graphPath}`);
        }

        buffer = readFileSync(graphPath);
        this.loadedGraph = graphPath;
      }

      // Initialize graph and load PBF data
      this.graph = new Graph();
      this.graph.loadPbfCH(buffer);

      // Create pathfinder with default options
      const defaultOptions = {
        ids: true,
        path: true,
        nodes: true,
        properties: true,
        ...pathfinderOptions,
      };

      this.finder = this.graph.createPathfinder(defaultOptions);
      this.lookup = new CoordinateLookup(this.graph);

      return this;
    } catch (error) {
      throw new Error(`Failed to load graph: ${error.message}`);
    }
  }

  /**
   * Load a default graph by name and profile
   *
   * @param {string} graphName - Name of the graph (e.g., 'eurostat', 'ornl')
   * @param {string} profile - Profile name (e.g., 'basic', 'panamax', 'vlcc')
   * @returns {SeaRouteCH} This instance for method chaining
   * @throws {Error} If default graph loading fails
   */
  loadDefaultGraph(graphName, profile = 'basic') {
    const fileName = profile === 'basic' ? `${graphName}.pbf` : `${graphName}-${profile}.pbf`;
    const graphPath = `./${fileName}`;  // Use relative path from working directory

    return this.loadGraph(graphPath);
  }

  /**
   * Check if a graph is currently loaded
   *
   * @returns {boolean} True if graph is loaded and ready for pathfinding
   */
  isReady() {
    return !!(this.graph && this.finder && this.lookup);
  }

  /**
   * Get information about the loaded graph
   *
   * @returns {Object|null} Graph information or null if no graph loaded
   */
  getGraphInfo() {
    if (!this.graph) return null;

    return {
      loaded: this.loadedGraph,
      nodeCount: this.graph.getNodeCount ? this.graph.getNodeCount() : 'unknown',
      edgeCount: this.graph.getEdgeCount ? this.graph.getEdgeCount() : 'unknown',
    };
  }

  /**
   * Find the closest network point to given coordinates
   *
   * @param {number} longitude - Longitude coordinate
   * @param {number} latitude - Latitude coordinate
   * @returns {Object} Closest network point information
   * @throws {Error} If graph is not loaded
   */
  findClosestPoint(longitude, latitude) {
    if (!this.isReady()) {
      throw new Error('Graph not loaded. Call loadGraph() first.');
    }

    return this.lookup.getClosestNetworkPt(longitude, latitude);
  }

  /**
   * Find a route between two coordinate points
   *
   * @param {number} startLng - Starting longitude
   * @param {number} startLat - Starting latitude
   * @param {number} endLng - Ending longitude
   * @param {number} endLat - Ending latitude
   * @param {Object} options - Routing options
   * @param {boolean} options.formatPath - Whether to format path geometry (default: true)
   * @returns {Object} Route result with path geometry and metadata
   * @throws {Error} If graph is not loaded or routing fails
   */
  findRoute(startLng, startLat, endLng, endLat, options = {}) {
    if (!this.isReady()) {
      throw new Error('Graph not loaded. Call loadGraph() first.');
    }

    const { formatPath = true } = options;

    try {
      // Find closest network points
      const startPt = this.findClosestPoint(startLng, startLat);
      const endPt = this.findClosestPoint(endLng, endLat);

      // Normalize coordinate pair for pathfinding
      const [normalizedStart, normalizedEnd] = normalizePair(startPt, endPt);

      // Execute pathfinding query
      const pathResult = this.finder.queryContractionHierarchy(normalizedStart, normalizedEnd);

      if (!pathResult || !pathResult.path) {
        return {
          success: false,
          error: 'No route found between the specified points',
          startPoint: { lng: startLng, lat: startLat, networkPoint: startPt },
          endPoint: { lng: endLng, lat: endLat, networkPoint: endPt },
        };
      }

      // Prepare result object
      const result = {
        success: true,
        distance: pathResult.distance || 0,
        duration: pathResult.duration || 0,
        startPoint: { lng: startLng, lat: startLat, networkPoint: startPt },
        endPoint: { lng: endLng, lat: endLat, networkPoint: endPt },
        rawPath: pathResult,
      };

      // Format path geometry if requested
      if (formatPath && pathResult.path) {
        result.geometry = this.formatPathGeometry(pathResult.path);
      }

      return result;
    } catch (error) {
      throw new Error(`Route finding failed: ${error.message}`);
    }
  }

  /**
   * Format path geometry for output, handling antimeridian crossing
   *
   * @param {Object} pathGeometry - GeoJSON geometry from pathfinder result
   * @param {Object} properties - Additional properties to attach to the geometry
   * @returns {Object|null} Formatted GeoJSON geometry, split at antimeridian if necessary
   */
  formatPathGeometry(pathGeometry, properties = {}) {
    if (!pathGeometry) return null;

    try {
      // Extract coordinates from path geometry
      const pathCoordinates = [];
      coordEach(pathGeometry, (coord) => {
        pathCoordinates.push(coord);
      });

      if (pathCoordinates.length < 2) return null;

      // Unwrap path to handle longitude wrapping
      const unwrapped = unwrapPath(pathCoordinates);
      if (unwrapped.length < 2) return null;

      // Create LineString and split at antimeridian
      const line = lineString(unwrapped, properties);
      return splitGeoJSON(line);
    } catch {
      // Path geometry formatting failed - return null
      return null;
    }
  }

  /**
   * Dispose of loaded graph and free memory
   */
  dispose() {
    this.graph = null;
    this.finder = null;
    this.lookup = null;
    this.loadedGraph = null;
  }
}

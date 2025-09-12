import Flatbush from 'flatbush';
import { coordAll } from '@turf/meta';
import { point } from '@turf/helpers';

/**
 * Handles spatial indexing and coordinate lookup operations for route networks
 * Provides fast nearest neighbor searches and point snapping to network vertices
 */
export class CoordinateLookup {
  /**
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.enableLogging=false] - Enable performance logging
   */
  constructor(options = {}) {
    this.options = {
      enableLogging: false,
      ...options,
    };

    this.vertices = null;
    this.index = null;
  }

  /**
   * Build spatial index from GeoJSON network
   * @param {Object} network - GeoJSON FeatureCollection
   * @returns {Object} Result with vertices and index
   */
  buildIndex(network) {
    this.log('Building spatial coordinate index...');
    this.time('Coordinate indexing');

    // Extract all coordinates from the network
    this.vertices = coordAll(network).map((coords) => coords);

    // Create spatial index
    this.index = new Flatbush(this.vertices.length);

    // Add each vertex to the index
    this.vertices.forEach((vertex) => {
      this.index.add(vertex[0], vertex[1], vertex[0], vertex[1]);
    });

    // Finalize the index
    this.index.finish();

    this.timeEnd('Coordinate indexing');
    this.log(`Indexed ${this.vertices.length} coordinate vertices`);

    return {
      vertices: this.vertices,
      index: this.index,
    };
  }

  /**
   * Get vertex coordinates by index
   * @param {number} vertexIndex - Index of the vertex
   * @returns {number[]|null} Vertex coordinates or null if not found
   */
  getVertex(vertexIndex) {
    if (!this.vertices || vertexIndex < 0 || vertexIndex >= this.vertices.length) {
      return null;
    }
    return this.vertices[vertexIndex];
  }

  /**
   * Snap a point to the nearest vertex in the network
   * @param {Object|number[]} pointToSnap - GeoJSON point or coordinate array
   * @returns {Object|null} Snapped point as GeoJSON or null if no suitable vertex found
   */
  snapToNearestVertex(pointToSnap) {
    const coordinates = this._extractCoordinates(pointToSnap);
    if (!coordinates) {
      return null;
    }

    if (!this.index || !this.vertices) {
      throw new Error('Index not built. Call buildIndex() first.');
    }

    const [lon, lat] = coordinates;
    const nearestVertexIds = this.index.neighbors(lon, lat, 1);

    if (nearestVertexIds.length === 0) {
      return null;
    }

    const nearestVertexId = nearestVertexIds[0];
    const nearestVertex = this.getVertex(nearestVertexId);

    if (!nearestVertex) {
      return null;
    }

    return point(nearestVertex);
  }

  /**
   * Extract coordinates from various input formats
   * @param {Object|number[]} input - Point input (GeoJSON point or coordinate array)
   * @returns {number[]|null} Coordinate array [lon, lat] or null if invalid
   * @private
   */
  _extractCoordinates(input) {
    if (!input) return null;

    // Handle coordinate array directly
    if (Array.isArray(input) && input.length >= 2) {
      return [input[0], input[1]];
    }

    // Handle GeoJSON point
    if (input.geometry && input.geometry.coordinates) {
      const coords = input.geometry.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        return [coords[0], coords[1]];
      }
    }

    return null;
  }

  // Logging utilities
  log(message) {
    if (this.options.enableLogging) {
      console.log(`[CoordinateLookup] ${message}`);
    }
  }

  time(label) {
    if (this.options.enableLogging) {
      console.time(`[CoordinateLookup] ${label}`);
    }
  }

  timeEnd(label) {
    if (this.options.enableLogging) {
      console.timeEnd(`[CoordinateLookup] ${label}`);
    }
  }
}

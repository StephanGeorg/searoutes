import { expect } from 'chai';
import { point } from '@turf/helpers';

import { CoordinateLookup } from '../src/core/CoordinateLookup.js';

describe('CoordinateLookup', () => {
  let lookup;
  let testNetwork;

  beforeEach(() => {
    // Create a simple test network with known coordinates
    testNetwork = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],   // Vertex 0
              [1, 0],   // Vertex 1
              [1, 1],   // Vertex 2
            ],
          },
          properties: {},
        },
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [1, 1],   // Vertex 2 (duplicate)
              [2, 1],   // Vertex 3
              [2, 2],   // Vertex 4
            ],
          },
          properties: {},
        },
      ],
    };

    lookup = new CoordinateLookup({ enableLogging: false });
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const defaultLookup = new CoordinateLookup();
      expect(defaultLookup.options.enableLogging).to.be.false;
      expect(defaultLookup.vertices).to.be.null;
      expect(defaultLookup.index).to.be.null;
    });

    it('should accept custom options', () => {
      const customLookup = new CoordinateLookup({ enableLogging: true });
      expect(customLookup.options.enableLogging).to.be.true;
    });
  });

  describe('buildIndex', () => {
    it('should build spatial index from GeoJSON network', () => {
      const result = lookup.buildIndex(testNetwork);

      expect(result).to.have.property('vertices');
      expect(result).to.have.property('index');
      expect(lookup.vertices).to.be.an('array');
      expect(lookup.index).to.not.be.null;
    });

    it('should extract all coordinates from network', () => {
      lookup.buildIndex(testNetwork);

      // Should have 6 vertices total (including duplicates from coordAll)
      expect(lookup.vertices).to.have.length(6);

      // Check specific coordinates
      expect(lookup.vertices[0]).to.deep.equal([0, 0]);
      expect(lookup.vertices[1]).to.deep.equal([1, 0]);
      expect(lookup.vertices[2]).to.deep.equal([1, 1]);
      expect(lookup.vertices[3]).to.deep.equal([1, 1]); // Duplicate
      expect(lookup.vertices[4]).to.deep.equal([2, 1]);
      expect(lookup.vertices[5]).to.deep.equal([2, 2]);
    });

    it('should handle empty network', () => {
      const emptyNetwork = {
        type: 'FeatureCollection',
        features: [],
      };

      const result = lookup.buildIndex(emptyNetwork);
      expect(result.vertices).to.have.length(0);
      expect(result.index).to.be.null;
    });
  });

  describe('getVertex', () => {
    beforeEach(() => {
      lookup.buildIndex(testNetwork);
    });

    it('should return vertex coordinates by index', () => {
      const vertex = lookup.getVertex(0);
      expect(vertex).to.deep.equal([0, 0]);
    });

    it('should return null for invalid index', () => {
      expect(lookup.getVertex(-1)).to.be.null;
      expect(lookup.getVertex(999)).to.be.null;
    });

    it('should return null for non-numeric index', () => {
      expect(lookup.getVertex('invalid')).to.be.null;
      expect(lookup.getVertex(null)).to.be.null;
      expect(lookup.getVertex(undefined)).to.be.null;
    });

    it('should return null when vertices not initialized', () => {
      const uninitializedLookup = new CoordinateLookup();
      expect(uninitializedLookup.getVertex(0)).to.be.null;
    });
  });

  describe('snapToNearestVertex', () => {
    beforeEach(() => {
      lookup.buildIndex(testNetwork);
    });

    it('should snap GeoJSON point to nearest vertex', () => {
      const inputPoint = point([0.1, 0.1]);
      const snapped = lookup.snapToNearestVertex(inputPoint);

      expect(snapped).to.not.be.null;
      expect(snapped.type).to.equal('Feature');
      expect(snapped.geometry.type).to.equal('Point');
      expect(snapped.geometry.coordinates).to.deep.equal([0, 0]);
    });

    it('should snap coordinate array to nearest vertex', () => {
      const inputCoords = [1.9, 1.9];
      const snapped = lookup.snapToNearestVertex(inputCoords);

      expect(snapped).to.not.be.null;
      expect(snapped.geometry.coordinates).to.deep.equal([2, 2]);
    });

    it('should handle coordinates exactly on vertex', () => {
      const exactPoint = point([1, 1]);
      const snapped = lookup.snapToNearestVertex(exactPoint);

      expect(snapped).to.not.be.null;
      expect(snapped.geometry.coordinates).to.deep.equal([1, 1]);
    });

    it('should return null for invalid input', () => {
      expect(lookup.snapToNearestVertex(null)).to.be.null;
      expect(lookup.snapToNearestVertex(undefined)).to.be.null;
      expect(lookup.snapToNearestVertex({})).to.be.null;
      expect(lookup.snapToNearestVertex([])).to.be.null;
      expect(lookup.snapToNearestVertex([1])).to.be.null; // Only one coordinate
    });

    it('should throw error when index not built', () => {
      const uninitializedLookup = new CoordinateLookup();
      const inputPoint = point([0, 0]);

      expect(() => {
        uninitializedLookup.snapToNearestVertex(inputPoint);
      }).to.throw('Index not built. Call buildIndex() first.');
    });

    it('should handle various coordinate input formats', () => {
      // Test different input formats
      const formats = [
        // GeoJSON point
        point([0.1, 0.1]),
        // Coordinate array
        [0.1, 0.1],
        // Object with geometry
        { geometry: { coordinates: [0.1, 0.1] } },
      ];

      formats.forEach((format, index) => {
        const snapped = lookup.snapToNearestVertex(format);
        expect(snapped, `Format ${index} failed`).to.not.be.null;
        expect(snapped.geometry.coordinates).to.deep.equal([0, 0]);
      });
    });
  });

  describe('_extractCoordinates', () => {
    it('should extract coordinates from coordinate array', () => {
      const coords = lookup._extractCoordinates([1, 2]);
      expect(coords).to.deep.equal([1, 2]);
    });

    it('should extract coordinates from GeoJSON point', () => {
      const geoPoint = point([3, 4]);
      const coords = lookup._extractCoordinates(geoPoint);
      expect(coords).to.deep.equal([3, 4]);
    });

    it('should handle coordinates with extra dimensions', () => {
      const coords3D = lookup._extractCoordinates([1, 2, 3]);
      expect(coords3D).to.deep.equal([1, 2]); // Should only take first two
    });

    it('should return null for invalid inputs', () => {
      expect(lookup._extractCoordinates(null)).to.be.null;
      expect(lookup._extractCoordinates(undefined)).to.be.null;
      expect(lookup._extractCoordinates({})).to.be.null;
      expect(lookup._extractCoordinates([])).to.be.null;
      expect(lookup._extractCoordinates([1])).to.be.null; // Only one coordinate
      expect(lookup._extractCoordinates('invalid')).to.be.null;
    });

    it('should handle malformed GeoJSON', () => {
      const malformed = { geometry: { coordinates: null } };
      expect(lookup._extractCoordinates(malformed)).to.be.null;
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle network with single point', () => {
      const singlePointNetwork = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [5, 5],
            },
            properties: {},
          },
        ],
      };

      lookup.buildIndex(singlePointNetwork);
      expect(lookup.vertices).to.have.length(1);

      const snapped = lookup.snapToNearestVertex([5.1, 5.1]);
      expect(snapped.geometry.coordinates).to.deep.equal([5, 5]);
    });

    it('should handle network with duplicate coordinates', () => {
      const duplicateNetwork = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[0, 0], [0, 0], [1, 1]],
            },
            properties: {},
          },
        ],
      };

      lookup.buildIndex(duplicateNetwork);
      expect(lookup.vertices).to.have.length(3); // coordAll extracts all coordinates

      const snapped = lookup.snapToNearestVertex([0.1, 0.1]);
      expect(snapped.geometry.coordinates).to.deep.equal([0, 0]);
    });

    it('should handle very large coordinates', () => {
      const largeCoordNetwork = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [180, 85], // Near max lat/lon
            },
            properties: {},
          },
        ],
      };

      lookup.buildIndex(largeCoordNetwork);
      const snapped = lookup.snapToNearestVertex([179.9, 84.9]);
      expect(snapped.geometry.coordinates).to.deep.equal([180, 85]);
    });
  });

  describe('performance characteristics', () => {
    it('should handle moderately sized network efficiently', () => {
      // Create a network with 100 points
      const features = [];
      for (let i = 0; i < 100; i++) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [i * 0.1, i * 0.1],
          },
          properties: {},
        });
      }

      const largeNetwork = {
        type: 'FeatureCollection',
        features,
      };

      const start = Date.now();
      lookup.buildIndex(largeNetwork);
      const buildTime = Date.now() - start;

      expect(buildTime).to.be.lessThan(1000); // Should build in under 1 second
      expect(lookup.vertices).to.have.length(100);

      // Test snapping performance
      const snapStart = Date.now();
      const snapped = lookup.snapToNearestVertex([5.05, 5.05]);
      const snapTime = Date.now() - snapStart;

      expect(snapTime).to.be.lessThan(100); // Should snap in under 100ms
      expect(snapped).to.not.be.null;
    });
  });

  describe('logging functionality', () => {
    it('should not log when logging disabled', () => {
      const logSpy = [];
      const originalLog = console.log;
      console.log = (...args) => logSpy.push(args);

      const quietLookup = new CoordinateLookup({ enableLogging: false });
      quietLookup.buildIndex(testNetwork);

      console.log = originalLog;

      // Should not have logged anything with CoordinateLookup prefix
      const lookupLogs = logSpy.filter(args =>
        args.some(arg => typeof arg === 'string' && arg.includes('[CoordinateLookup]')),
      );
      expect(lookupLogs).to.have.length(0);
    });

    it('should log when logging enabled', () => {
      const logSpy = [];
      const originalLog = console.log;
      console.log = (...args) => logSpy.push(args);

      const verboseLookup = new CoordinateLookup({ enableLogging: true });
      verboseLookup.buildIndex(testNetwork);

      console.log = originalLog;

      // Should have logged with CoordinateLookup prefix
      const lookupLogs = logSpy.filter(args =>
        args.some(arg => typeof arg === 'string' && arg.includes('[CoordinateLookup]')),
      );
      expect(lookupLogs.length).to.be.greaterThan(0);
    });
  });
});

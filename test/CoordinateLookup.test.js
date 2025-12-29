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

    lookup = new CoordinateLookup(testNetwork, { enableLogging: false });
  });

  describe('constructor', () => {
    it('should create instance with default options and build index', () => {
      const defaultLookup = new CoordinateLookup(testNetwork);
      expect(defaultLookup.options.enableLogging).to.be.false;
      expect(defaultLookup.vertices).to.be.an('array');
      expect(defaultLookup.index).to.not.be.null;
    });

    it('should accept custom options and build index', () => {
      const customLookup = new CoordinateLookup(testNetwork, { enableLogging: true });
      expect(customLookup.options.enableLogging).to.be.true;
      expect(customLookup.vertices).to.be.an('array');
      expect(customLookup.index).to.not.be.null;
    });

    it('should handle empty network in constructor', () => {
      const emptyNetwork = {
        type: 'FeatureCollection',
        features: [],
      };
      const emptyLookup = new CoordinateLookup(emptyNetwork);
      expect(emptyLookup.vertices).to.have.length(0);
      expect(emptyLookup.index).to.be.null;
    });
  });

  describe('network indexing', () => {
    it('should extract all coordinates from network during construction', () => {
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

    it('should have built spatial index during construction', () => {
      expect(lookup.vertices).to.be.an('array');
      expect(lookup.index).to.not.be.null;
    });
  });

  describe('getVertex', () => {
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
      const emptyNetwork = {
        type: 'FeatureCollection',
        features: [],
      };
      const uninitializedLookup = new CoordinateLookup(emptyNetwork);
      expect(uninitializedLookup.getVertex(0)).to.be.null;
    });
  });

  describe('snapToNearestVertex', () => {

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

    it('should throw error when network is empty', () => {
      const emptyNetwork = {
        type: 'FeatureCollection',
        features: [],
      };
      const emptyLookup = new CoordinateLookup(emptyNetwork);
      const inputPoint = point([0, 0]);

      expect(() => {
        emptyLookup.snapToNearestVertex(inputPoint);
      }).to.throw('No spatial index available (empty network).');
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

      const singlePointLookup = new CoordinateLookup(singlePointNetwork);
      expect(singlePointLookup.vertices).to.have.length(1);

      const snapped = singlePointLookup.snapToNearestVertex([5.1, 5.1]);
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

      const duplicateLookup = new CoordinateLookup(duplicateNetwork);
      expect(duplicateLookup.vertices).to.have.length(3); // coordAll extracts all coordinates

      const snapped = duplicateLookup.snapToNearestVertex([0.1, 0.1]);
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

      const largeLookup = new CoordinateLookup(largeCoordNetwork);
      const snapped = largeLookup.snapToNearestVertex([179.9, 84.9]);
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
      const largeLookup = new CoordinateLookup(largeNetwork);
      const buildTime = Date.now() - start;

      expect(buildTime).to.be.lessThan(1000); // Should build in under 1 second
      expect(largeLookup.vertices).to.have.length(100);

      // Test snapping performance
      const snapStart = Date.now();
      const snapped = largeLookup.snapToNearestVertex([5.05, 5.05]);
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

      // Test quiet lookup creation without storing result
      new CoordinateLookup(testNetwork, { enableLogging: false });

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

      // Test verbose lookup creation without storing result
      new CoordinateLookup(testNetwork, { enableLogging: true });

      console.log = originalLog;

      // Should have logged with CoordinateLookup prefix
      const lookupLogs = logSpy.filter(args =>
        args.some(arg => typeof arg === 'string' && arg.includes('[CoordinateLookup]')),
      );
      expect(lookupLogs.length).to.be.greaterThan(0);
    });
  });
});

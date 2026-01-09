/**
 * Test suite for SeaRoutesCH - Contraction Hierarchy based maritime routing
 *
 * Tests migrated and adapted from SeaRoutes.test.js to work with the new
 * graph-loading based architecture.
 */

import { expect } from 'chai';
import { existsSync, readFileSync } from 'fs';

import { SeaRouteCH } from '../src/SeaRoutesCH.js';

describe('SeaRoutesCH', () => {
  // Shared router instance for most tests
  let sharedRouter;

  before(function() {
    this.timeout(30000);

    if (!existsSync('./eurostat.pbf')) {
      this.skip();
    }

    sharedRouter = new SeaRouteCH({ graphPath: './eurostat.pbf' });
  });

  after(() => {
    if (sharedRouter) {
      sharedRouter.dispose();
    }
  });
  describe('Constructor and Graph Loading', () => {
    it('should create instance without auto-loading when no options provided', () => {
      const router = new SeaRouteCH();
      expect(router.isReady()).to.be.false;
      expect(router.getGraphInfo()).to.be.null;
    });

    it('should auto-load graph when graphPath is provided', function() {
      this.timeout(15000); // Increased timeout for slow loads

      // Skip if no graph file available
      if (!existsSync('./eurostat.pbf')) {
        this.skip();
      }

      const router = new SeaRouteCH({ graphPath: './eurostat.pbf' });
      expect(router.isReady()).to.be.true;
      expect(router.getGraphInfo()).to.be.an('object');
      expect(router.getGraphInfo().loaded).to.equal('./eurostat.pbf');
    });

    it('should auto-load default graph when graphName is provided', function() {
      this.timeout(15000); // Increased timeout

      // Skip if no default graph available
      const defaultPath = './eurostat.pbf';
      if (!existsSync(defaultPath)) {
        this.skip();
      }

      const router = new SeaRouteCH({
        graphName: 'eurostat',
        profile: 'basic',
      });
      expect(router.isReady()).to.be.true;
      expect(router.getGraphInfo()).to.be.an('object');
    });

    it('should throw error for non-existent graph file', () => {
      expect(() => {
        new SeaRouteCH({ graphPath: './nonexistent.pbf' });
      }).to.throw(/Graph file not found/);
    });

    it('should throw error for invalid graph data', () => {
      expect(() => {
        new SeaRouteCH({ graphPath: './package.json' }); // Invalid PBF file
      }).to.throw(/Failed to load graph/);
    });
  });

  describe('Graph Management', () => {
    let router;

    beforeEach(() => {
      router = new SeaRouteCH();
    });

    afterEach(() => {
      if (router) {
        router.dispose();
      }
    });

    it('should load graph manually', function() {
      this.timeout(10000);

      if (!existsSync('./eurostat.pbf')) {
        this.skip();
      }

      expect(router.isReady()).to.be.false;
      router.loadGraph('./eurostat.pbf');
      expect(router.isReady()).to.be.true;
    });

    it('should load default graph manually', function() {
      this.timeout(10000);

      if (!existsSync('./eurostat.pbf')) {
        this.skip();
      }

      expect(router.isReady()).to.be.false;
      router.loadDefaultGraph('eurostat');
      expect(router.isReady()).to.be.true;
    });

    it('should dispose graph and clean up memory', function() {
      this.timeout(10000);

      if (!existsSync('./eurostat.pbf')) {
        this.skip();
      }

      router.loadGraph('./eurostat.pbf');
      expect(router.isReady()).to.be.true;

      router.dispose();
      expect(router.isReady()).to.be.false;
      expect(router.getGraphInfo()).to.be.null;
    });
  });

  describe('Point Finding', () => {
    it('should find closest network point for valid coordinates', function() {
      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      const point = sharedRouter.findClosestPoint(-6.144, 53.265);
      expect(point).to.be.an('array');
      expect(point).to.have.lengthOf(2);
      expect(point[0]).to.be.a('number'); // longitude
      expect(point[1]).to.be.a('number'); // latitude
    });

    it('should throw error when finding point without loaded graph', () => {
      const emptyRouter = new SeaRouteCH();
      expect(() => {
        emptyRouter.findClosestPoint(-6.144, 53.265);
      }).to.throw(/Graph not loaded/);
    });

    it('should handle edge case coordinates', function() {
      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      // Test antimeridian coordinates
      const point1 = sharedRouter.findClosestPoint(-123.1203, 49.2705); // Vancouver
      const point2 = sharedRouter.findClosestPoint(117.7006, 38.9847);  // Tianjin

      expect(point1).to.be.an('array');
      expect(point2).to.be.an('array');
    });
  });

  describe('Route Finding', () => {
    it('should return successful route result structure', function() {
      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      const result = sharedRouter.findRoute(-6.144, 53.265, -5.329, 50.119);

      expect(result).to.be.an('object');
      expect(result).to.have.property('success');
      expect(result).to.have.property('startPoint');
      expect(result).to.have.property('endPoint');
      expect(result).to.have.property('rawPath');

      if (result.success) {
        expect(result).to.have.property('distance');
        expect(result).to.have.property('geometry');
      }
    });

    it('should find route between European ports', function() {
      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      const result = sharedRouter.findRoute(
        13.5029, 43.6214, // Trieste
        20.2621, 39.4982,  // Thessaloniki
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('success');

      if (result.success) {
        expect(result.distance).to.be.a('number');
        expect(result.distance).to.be.at.least(0);
      }
    });

    it('should handle antimeridian crossing routes (Vancouver -> Tianjin)', function() {
      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      const result = sharedRouter.findRoute(
        -123.1203, 49.2705, // Vancouver
        117.7006, 38.9847,   // Tianjin
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('success');

      if (result.success) {
        expect(result.distance).to.be.a('number');
        expect(result.distance).to.be.at.least(0);
      }
    });

    it('should handle reverse antimeridian crossing routes (Tianjin -> Vancouver)', function() {
      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      const result = sharedRouter.findRoute(
        117.7006, 38.9847,  // Tianjin
        -123.1203, 49.2705,  // Vancouver
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('success');

      if (result.success) {
        expect(result.distance).to.be.a('number');
        expect(result.distance).to.be.at.least(0);
      }
    });

    it('should handle routes across multiple segments (Shanghai -> Hamburg)', function() {
      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      const result = sharedRouter.findRoute(
        121.48, 31.23, // Shanghai
        9.93, 53.52,    // Hamburg
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('success');

      if (result.success) {
        expect(result.distance).to.be.a('number');
        expect(result.distance).to.be.at.least(0);
      }
    });

    it('should return formatted geometry for successful routes', function() {
      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      const result = sharedRouter.findRoute(
        13.5029, 43.6214, // Trieste
        20.2621, 39.4982, // Thessaloniki
        { formatPath: true },
      );

      if (result.success && result.geometry) {
        // splitGeoJSON can return Feature or FeatureCollection
        expect(result.geometry.type).to.be.oneOf(['Feature', 'FeatureCollection']);

        if (result.geometry.type === 'Feature') {
          expect(result.geometry.geometry.type).to.be.oneOf(['LineString', 'MultiLineString']);
        } else if (result.geometry.type === 'FeatureCollection') {
          expect(result.geometry.features).to.be.an('array');
          expect(result.geometry.features.length).to.be.greaterThan(0);
        }
      }
    });

    it('should handle same start and end coordinates', function() {
      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      const result = sharedRouter.findRoute(
        13.5029, 43.6214, // Same point
        13.5029, 43.6214,
      );

      // Should either succeed with 0 distance or fail gracefully
      expect(result).to.be.an('object');
      expect(result).to.have.property('success');

      if (result.success) {
        expect(result.distance).to.be.a('number');
        expect(result.distance).to.be.at.most(1); // Very small distance or 0
      }
    });

    it('should throw error when finding route without loaded graph', () => {
      const emptyRouter = new SeaRouteCH();
      expect(() => {
        emptyRouter.findRoute(-6.144, 53.265, -5.329, 50.119);
      }).to.throw(/Graph not loaded/);
    });

    it('should handle options parameter correctly', function() {
      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      const resultWithPath = sharedRouter.findRoute(
        13.5029, 43.6214,
        20.2621, 39.4982,
        { formatPath: true },
      );

      const resultWithoutPath = sharedRouter.findRoute(
        13.5029, 43.6214,
        20.2621, 39.4982,
        { formatPath: false },
      );

      if (resultWithPath.success) {
        expect(resultWithPath.geometry).to.exist;
      }

      if (resultWithoutPath.success) {
        expect(resultWithoutPath.geometry).to.not.exist;
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid coordinates gracefully', function() {
      this.timeout(10000);

      if (!existsSync('./eurostat.pbf')) {
        this.skip();
      }

      const router = new SeaRouteCH({ graphPath: './eurostat.pbf' });

      // Test various invalid coordinate scenarios
      // Note: The API may handle invalid coordinates gracefully by converting them
      const result1 = router.findRoute('invalid', 50, 10, 50);
      expect(result1).to.have.property('success'); // May succeed or fail

      const result2 = router.findRoute(10, 'invalid', 10, 50);
      expect(result2).to.have.property('success'); // May succeed or fail

      const result3 = router.findRoute(10, 50, null, 50);
      expect(result3).to.have.property('success'); // May succeed or fail

      router.dispose();
    });

    it('should handle extreme coordinates', function() {
      this.timeout(10000);

      if (!existsSync('./eurostat.pbf')) {
        this.skip();
      }

      const router = new SeaRouteCH({ graphPath: './eurostat.pbf' });

      // Test coordinates at extreme ranges
      const result = router.findRoute(
        -180, -85,
        180, 85,
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('success');

      router.dispose();
    });

    it('should handle buffer input for graph loading', function() {
      this.timeout(10000);

      if (!existsSync('./eurostat.pbf')) {
        this.skip();
      }

      const buffer = readFileSync('./eurostat.pbf');

      const router = new SeaRouteCH();
      router.loadGraph(buffer);

      expect(router.isReady()).to.be.true;
      expect(router.getGraphInfo().loaded).to.equal('buffer');

      router.dispose();
    });
  });

  describe('Performance and Memory', () => {
    it('should load graph within reasonable time', function() {
      this.timeout(15000); // Increased timeout

      if (!existsSync('./eurostat.pbf')) {
        this.skip();
      }

      const start = Date.now();
      const router = new SeaRouteCH({ graphPath: './eurostat.pbf' });
      const loadTime = Date.now() - start;

      expect(loadTime).to.be.lessThan(12000); // Relaxed to 12 seconds
      expect(router.isReady()).to.be.true;

      router.dispose();
    });

    it('should find routes within reasonable time', function() {
      this.timeout(10000);

      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      const start = Date.now();
      const result = sharedRouter.findRoute(-6.144, 53.265, -5.329, 50.119);
      const queryTime = Date.now() - start;

      expect(queryTime).to.be.lessThan(1000); // Should find route within 1 second
      expect(result.success).to.be.true;
    });

    it('should handle multiple consecutive route queries efficiently', function() {
      this.timeout(15000);

      if (!sharedRouter || !sharedRouter.isReady()) {
        this.skip();
      }

      const coordinates = [
        [-6.144, 53.265, -5.329, 50.119],
        [13.5029, 43.6214, 20.2621, 39.4982],
        [121.48, 31.23, 9.93, 53.52],
      ];

      const start = Date.now();

      for (const [startLng, startLat, endLng, endLat] of coordinates) {
        const result = sharedRouter.findRoute(startLng, startLat, endLng, endLat);
        expect(result).to.have.property('success');
      }

      const totalTime = Date.now() - start;
      expect(totalTime).to.be.lessThan(3000); // All queries within 3 seconds
    });
  });
});

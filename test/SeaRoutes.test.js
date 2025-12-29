import { expect } from 'chai';

import { SeaRoutes } from '../src/SeaRoutes.js';

const SeaRoute = SeaRoutes; // Legacy alias for compatibility

let seaRoutes;

describe('SeaRoute', () => {
  describe('Constructor', () => {
    it('should load default "eurostat" network when no options provided', function(done) {
      this.timeout(0);
      const route = new SeaRoute();
      expect(route.network).to.exist;
      expect(route.network.features).to.be.an('array');
      expect(route.network.features.length).to.be.greaterThan(0);
      done();
    });

    it('should load ornl network when specified', function(done) {
      this.timeout(0);
      const route = new SeaRoute({
        defaultNetwork: 'ornl',
        // enableLogging: true,
      });
      expect(route.network).to.exist;
      expect(route.network.features).to.be.an('array');
      done();
    });

    it('should use custom network when provided', () => {
      const customNetwork = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[0, 0], [1, 1]],
            },
            properties: {},
          },
        ],
      };
      const route = new SeaRoute({ network: customNetwork });
      expect(route.network).to.equal(customNetwork);
    });

    it('should throw error for invalid network name', () => {
      expect(() => {
        new SeaRoute({ defaultNetwork: 'nonexistent' });
      }).to.throw(/Invalid network name/);
    });

    it('should use all options correctly',function(done) {
      this.timeout(0);
      const route = new SeaRoute({
        defaultNetwork: 'ornl',
        enableLogging: false,
        tolerance: 0.001,
        restrictedMultiplier: 2.0,
      });

      expect(route.options.enableLogging).to.be.false;
      expect(route.options.tolerance).to.equal(0.001);
      expect(route.options.restrictedMultiplier).to.equal(2.0);
      done();
    });
  });

  describe('SeaRoute class', () => {
    before(function beforeAllTests() {
      this.timeout(0);
      seaRoutes = new SeaRoute({
        // network: geojson,
        // maritimeProfiles: profiles,
        enableLogging: true,
      });
    });

    it('should return valid GeoJSON Feature', () => {
      const result = seaRoutes.getShortestRoute(
        [-6.144, 53.265],
        [-5.329, 50.119],
        { path: false },
      );

      expect(result).to.be.an('object');
      expect(result.type).to.equal('Feature');
      expect(result.geometry).to.be.an('object');
      expect(result.properties).to.be.an('object');
    });

    it('should return MultiPoint geometry when path is false', () => {
      const result = seaRoutes.getShortestRoute(
        [-6.144, 53.265],
        [-5.329, 50.119],
        { path: false },
      );

      expect(result.type).to.equal('Feature');
      expect(result.geometry.type).to.equal('MultiPoint');
      expect(result.geometry.coordinates).to.be.an('array');
      expect(result.geometry.coordinates).to.have.lengthOf(2);
      expect(result.geometry.coordinates[0]).to.be.an('array').with.lengthOf(2);
      expect(result.geometry.coordinates[1]).to.be.an('array').with.lengthOf(2);
    });

    it('should return geometry when path is true', () => {
      const result = seaRoutes.getShortestRoute(
        [-6.144, 53.265],
        [-5.329, 50.119],
        { path: true },
      );

      expect(result).to.be.an('object');
      // splitGeoJSON can return Feature or FeatureCollection
      expect(result.type).to.be.oneOf(['Feature', 'FeatureCollection']);

      if (result.type === 'Feature') {
        expect(result.geometry).to.exist;
        expect(result.geometry.type).to.be.oneOf(['LineString', 'MultiLineString']);
      } else if (result.type === 'FeatureCollection') {
        expect(result.features).to.be.an('array');
        expect(result.features.length).to.be.greaterThan(0);
      }
    });

    it('should return sea route distance', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [13.5029, 43.6214],
          [20.2621, 39.4982],
          { path: false },
        );
      expect(seaRoute.properties.distance).to.be.equal(746.199);
      expect(seaRoute.properties.distanceNM).to.be.equal(402.92);
      expect(seaRoute.geometry).to.not.equal(null);
      expect(seaRoute.type).to.equal('Feature');
      expect(seaRoute.geometry.type).to.equal('MultiPoint');
      expect(seaRoute.geometry.coordinates.length).to.equal(2);
      expect(seaRoute.geometry.coordinates[0]).to.deep.equal([13.5068, 43.621025]);
      expect(seaRoute.geometry.coordinates[1]).to.deep.equal([20.2647, 39.5003]);

      // Debugging: uncomment util import above
      /* console.log(util.inspect(seaRoute, {
        depth: null,
        colors: false,
        maxArrayLength: null,
      })); */
      done();
    });

    it('should return ZERO sea route distance', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [104.17583333333334, 1.1191666666666666],
          [104.17666666666668, 1.1180555555555556],
          { path: true },
        );
      expect(seaRoute.properties.distance).to.be.equal(0);
      expect(seaRoute.properties.distanceNM).to.be.equal(0);
      expect(seaRoute.type).to.equal('Feature');
      expect(seaRoute.geometry).to.equal(null);

      done();
    });

    it('should return antimeridian sea route distances (CAVAN -> CNTXG)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [-123.1203, 49.2705],
          [117.7006, 38.9847],
          { path: false },
        );
      expect(seaRoute.properties.distance).to.be.equal(10560.571);
      expect(seaRoute.properties.distanceNM).to.be.equal(5702.25);
      done();
    });

    it('should return antimeridian sea route distances (CAVAN <- CNTXG)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [117.7006, 38.9847],
          [-123.1203, 49.2705],
          { path: false },
        );
      expect(seaRoute.properties.distance).to.be.equal(10560.571);
      expect(seaRoute.properties.distanceNM).to.be.equal(5702.25);
      done();
    });

    it('should return antimeridian sea route distances (TWKEL -> MXMZT)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [121.714048, 25.138440],
          [-106.406200, 23.232900],
          { path: false },
        );
      expect(seaRoute.properties.distance).to.be.equal(12920.344);
      expect(seaRoute.properties.distanceNM).to.be.equal(6976.43);


      // Debugging
      // console.log('%o', seaRoute);
      // console.log(util.inspect(seaRoute.path, false, null, true /* enable colors */))

      done();
    });

    it('should return a sea route path geometry', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [13.5029, 43.6214],
          [20.2621, 39.4982],
          { path: true },
        );
      expect(seaRoute.geometry).to.not.equal(undefined);
      expect(seaRoute.type).to.equal('Feature');
      expect(seaRoute.geometry.type).to.equal('LineString');
      expect(seaRoute.geometry.coordinates.length).to.be.greaterThan(0);
      done();
    });

    it('should return antimeridian sea route path (CAVAN -> CNTXG)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [-123.1203, 49.2705],
          [117.7006, 38.9847],
          { path: true },
        );
      expect(seaRoute.geometry).to.not.equal(undefined);
      expect(seaRoute.type).to.equal('Feature');
      expect(seaRoute.geometry.type).to.equal('MultiLineString');
      expect(seaRoute.geometry.coordinates.length).to.be.equal(2);
      done();
    });

    it('should return antimeridian sea route path (CAVAN <- CNTXG)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [117.7006, 38.9847],
          [-123.1203, 49.2705],
          { path: true },
        );
      expect(seaRoute.geometry).to.not.equal(undefined);
      expect(seaRoute.type).to.equal('Feature');
      expect(seaRoute.geometry.type).to.equal('MultiLineString');
      expect(seaRoute.geometry.coordinates.length).to.be.equal(2);
      done();
    });

    it('should return sea route path (CNSGH  <- DEHAM)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [121.48, 31.23],
          [9.93, 53.52],
          {
            path: true,
          },
        );

      // Debugging: uncomment util import above
      /* console.log(util.inspect(seaRoute.path, {
        depth: null,
        colors: false,
        maxArrayLength: null,
      })); */

      expect(seaRoute.properties.distance).to.be.equal(15315.904);
      expect(seaRoute.properties.distanceNM).to.be.equal(8269.93);
      expect(seaRoute.geometry).to.not.equal(undefined);
      expect(seaRoute.type).to.equal('Feature');
      expect(seaRoute.geometry.type).to.equal('MultiLineString');
      expect(seaRoute.geometry.coordinates.length).to.be.equal(3);
      done();
    });

    it('should return sea route path from "panamax" optimized profile (CNSGH  <- DEHAM)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [121.48, 31.23],
          [9.93, 53.52],
          {
            path: true,
            profile: 'default',
          },
        );

      // Debugging: uncomment util import above
      /* console.log(util.inspect(seaRoute, {
        depth: null,
        colors: false,
        maxArrayLength: null,
      })); */

      // Result logged for debugging purposes

      expect(seaRoute.properties.distance).to.be.equal(26269.169);
      expect(seaRoute.properties.distanceNM).to.be.equal(14184.22);
      expect(seaRoute.geometry).to.not.equal(undefined);
      expect(seaRoute.type).to.equal('Feature');
      expect(seaRoute.geometry.type).to.equal('LineString');
      expect(seaRoute.geometry.coordinates.length).to.be.equal(446);
      done();
    });

    it('should return sea route path from "aut )', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [115.83106007736924, -31.993120092120524],
          [47.77608641070968, 29.350551216537],
          {
            path: true,
            profile: 'default',
          },
        );

      // Debugging: uncomment util import above
      /* console.log(util.inspect(seaRoute, {
        depth: null,
        colors: false,
        maxArrayLength: null,
      })); */

      // Result logged for debugging purposes

      expect(seaRoute.properties.distance).to.be.equal(26269.169);
      expect(seaRoute.properties.distanceNM).to.be.equal(14184.22);
      expect(seaRoute.geometry).to.not.equal(undefined);
      expect(seaRoute.type).to.equal('Feature');
      expect(seaRoute.geometry.type).to.equal('LineString');
      expect(seaRoute.geometry.coordinates.length).to.be.equal(446);
      done();
    });

  });
});

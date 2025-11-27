import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// import util from 'util'; // Used for debugging

import { SeaRoute } from '../src/SeaRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
      }).to.throw(/Failed to load default network/);
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
      // const geojson = JSON.parse(readFileSync(join(__dirname, '../data/networks/eurostat.geojson'), 'utf8'));
      // const profiles = JSON.parse(readFileSync(join(__dirname, '../data/profiles/default_v1.json'), 'utf8'));

      this.timeout(0);
      seaRoutes = new SeaRoute({
        // network: geojson,
        // maritimeProfiles: profiles,
        enableLogging: true,
      });
    });

    it('should return sea route distance', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [13.5029, 43.6214],
          [20.2621, 39.4982],
          { path: false },
        );
      const { distance, distanceNM } = seaRoute;
      expect(distance).to.be.equal(746.199);
      expect(distanceNM).to.be.equal(402.92);
      done();
    });

    it('should return ZERO sea route distance', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [104.17583333333334, 1.1191666666666666],
          [104.17666666666668, 1.1180555555555556],
          { path: true },
        );
      const { distance, distanceNM } = seaRoute;
      expect(distance).to.be.equal(0);
      expect(distanceNM).to.be.equal(0);
      done();
    });

    it('should return antimeridian sea route distances (CAVAN -> CNTXG)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [-123.1203, 49.2705],
          [117.7006, 38.9847],
          { path: false },
        );
      const { distance, distanceNM } = seaRoute;

      expect(distance).to.be.equal(10560.571);
      expect(distanceNM).to.be.equal(5702.25);
      done();
    });

    it('should return antimeridian sea route distances (CAVAN <- CNTXG)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [117.7006, 38.9847],
          [-123.1203, 49.2705],
          { path: false },
        );
      const { distance, distanceNM } = seaRoute;

      expect(distance).to.be.equal(10560.571);
      expect(distanceNM).to.be.equal(5702.25);
      done();
    });

    it('should return antimeridian sea route distances (TWKEL -> MXMZT)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [121.714048, 25.138440],
          [-106.406200, 23.232900],
          { path: false },
        );
      const { distance, distanceNM } = seaRoute;

      expect(distance).to.be.equal(12920.344);
      expect(distanceNM).to.be.equal(6976.43);

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
      const { path } = seaRoute;

      expect(path).to.not.equal(undefined);
      expect(path.type).to.equal('Feature');
      expect(path.geometry.type).to.equal('LineString');
      expect(path.geometry.coordinates.length).to.be.greaterThan(0);

      done();
    });

    it('should return antimeridian sea route path (CAVAN -> CNTXG)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [-123.1203, 49.2705],
          [117.7006, 38.9847],
          { path: true },
        );
      const { path } = seaRoute;

      expect(path).to.not.equal(undefined);
      expect(path.type).to.equal('Feature');
      expect(path.geometry.type).to.equal('MultiLineString');
      expect(path.geometry.coordinates.length).to.be.equal(2);
      done();
    });

    it('should return antimeridian sea route path (CAVAN <- CNTXG)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [117.7006, 38.9847],
          [-123.1203, 49.2705],
          { path: true },
        );
      const { path } = seaRoute;

      expect(path).to.not.equal(undefined);
      expect(path.type).to.equal('Feature');
      expect(path.geometry.type).to.equal('MultiLineString');
      expect(path.geometry.coordinates.length).to.be.equal(2);
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
      const { path, distance, distanceNM } = seaRoute;

      // Debugging: uncomment util import above
      /* console.log(util.inspect(seaRoute.path, {
        depth: null,
        colors: false,
        maxArrayLength: null,
      })); */ 

      expect(distance).to.be.equal(15315.904);
      expect(distanceNM).to.be.equal(8269.93);
      expect(path).to.not.equal(undefined);
      expect(path.type).to.equal('Feature');
      expect(path.geometry.type).to.equal('MultiLineString');
      expect(path.geometry.coordinates.length).to.be.equal(3);
      done();
    });

    it('should return sea route path from "panamax" optimized profile (CNSGH  <- DEHAM)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [121.48, 31.23],
          [9.93, 53.52],
          { 
            path: true,
            profile: 'panamax',
          },
        );
      const { path, distance, distanceNM } = seaRoute;

      // Debugging: uncomment util import above
      /* console.log(util.inspect(seaRoute.path, {
        depth: null,
        colors: false,
        maxArrayLength: null,
      })); */

      expect(distance).to.be.equal(26269.169);
      expect(distanceNM).to.be.equal(14184.22);
      expect(path).to.not.equal(undefined);
      expect(path.type).to.equal('Feature');
      expect(path.geometry.type).to.equal('LineString');
      expect(path.geometry.coordinates.length).to.be.equal(446);
      done();
    });

  });
});

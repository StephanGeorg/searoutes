import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
// import util from 'util'; // Used for debugging

import { SeaRoute } from '../src/SeaRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let seaRoutes;

describe('searoutes module', () => {

  describe('SeaRoute class', () => {
    before(function beforeAllTests() {
      // Runs once before all tests in this describe block
      const geojson = JSON.parse(readFileSync(join(__dirname, '../data/networks/eurostat.geojson'), 'utf8'));
      const profiles = JSON.parse(readFileSync(join(__dirname, '../data/profiles/example_v1.json'), 'utf8'));

      this.timeout(0);
      seaRoutes = new SeaRoute(geojson, profiles, { enableLogging: true });
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

    it('should return sea route path from "panamax" optimized profile (CNSGH  <- DEHAM)', (done) => {
      const seaRoute = seaRoutes
        .getShortestRoute(
          [121.48, 31.23],
          [9.93, 53.52],
          { path: true, profile: 'panamax' },
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

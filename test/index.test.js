import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { SeaRoute } from '../src/SeaRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let route;

describe('searoutes module', () => {

  describe('SeaRoute class', () => {
    before(function beforeAllTests() {
      // Runs once before all tests in this describe block
      const geojson = JSON.parse(readFileSync(join(__dirname, '../data/networks/eurostat.geojson'), 'utf8'));
      const profiles = JSON.parse(readFileSync(join(__dirname, '../data/profiles/example_v1.json'), 'utf8'));

      const params = {
        from: 'Hamburg',
      };

      this.timeout(0);
      route = new SeaRoute(geojson, profiles, params);
    });

    it('should return sea route distance', (done) => {
      const seaRoute = route.getShortestRoute(
        [13.5029, 43.6214],
        [20.2621, 39.4982],
        { path: false },
      );
      const { distance, distanceNM } = seaRoute;
      expect(distance).to.be.equal(746.199);
      expect(distanceNM).to.be.equal(402.92);
      done();
    });

  });
});

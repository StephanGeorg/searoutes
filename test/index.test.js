import { expect } from 'chai';
import { greet, SeaRoute } from '../src/index.js';

import { loadJsonFile } from '../src/utils/data.js';

let route;

describe('searoutes module', () => {
  describe('greet function', () => {
    it('should return a greeting message', () => {
      const result = greet('World');
      expect(result).to.equal('Hello, World! Welcome to searoutes.');
    });

    it('should throw an error for non-string input', () => {
      expect(() => greet(123)).to.throw('Name must be a string');
    });

    it('should handle empty string', () => {
      const result = greet('');
      expect(result).to.equal('Hello, ! Welcome to searoutes.');
    });
  });

  describe('SeaRoute class', () => {
    before(function beforeAllTests() {
      // Runs once before all tests in this describe block
      const geojson = loadJsonFile('../../data/networks/eurostat.geojson');
      const profiles = loadJsonFile('../../data/profiles/maritime_passage_rules_v1.json');

      const params = {
        from: 'Hamburg',
      };

      this.timeout(0);
      route = new SeaRoute(geojson, profiles, params);
    });

    it('should create a route with correct properties', () => {
      const routeConfig = route.getRouteInfo();
      expect(routeConfig.params.from).to.equal('Hamburg');
      // expect(routeConfig.params.to).to.equal('New York');
    });

  });
});

import { expect } from 'chai';
import { greet, SeaRoute } from '../src/index.js';

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
    let route;

    beforeEach(() => {
      route = new SeaRoute('Hamburg', 'New York', 3500);
    });

    it('should create a route with correct properties', () => {
      expect(route.from).to.equal('Hamburg');
      expect(route.to).to.equal('New York');
      expect(route.distance).to.equal(3500);
    });

    it('should provide route information', () => {
      const info = route.getRouteInfo();
      expect(info).to.deep.equal({
        from: 'Hamburg',
        to: 'New York',
        distance: 3500,
        description: 'Route from Hamburg to New York'
      });
    });

    it('should calculate time correctly', () => {
      const time = route.calculateTime(20); // 20 knots
      expect(time).to.equal(175); // 3500 / 20 = 175 hours
    });

    it('should use default speed when not provided', () => {
      const time = route.calculateTime();
      expect(time).to.equal(350); // 3500 / 10 = 350 hours
    });

    it('should throw error for invalid speed', () => {
      expect(() => route.calculateTime(0)).to.throw('Speed must be positive');
      expect(() => route.calculateTime(-5)).to.throw('Speed must be positive');
    });

    it('should handle zero distance', () => {
      const localRoute = new SeaRoute('A', 'B', 0);
      expect(localRoute.calculateTime(10)).to.equal(0);
    });
  });
});

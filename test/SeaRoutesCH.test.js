import { expect } from 'chai';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import util from 'util'; // Used for debugging

import { SeaRouteCH } from '../src/SeaRoutesCH.js';


let seaRoutes;

describe('SeaRouteCH', () => {
  describe('Constructor', () => {
    it('should load default "eurostat" network when no options provided', function(done) {
      this.timeout(0);
      const route = new SeaRouteCH();

      done();
    });
  });
});

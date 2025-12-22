import { Graph, CoordinateLookup } from 'contraction-hierarchy-js';
import { coordEach } from '@turf/meta';
import { lineString } from '@turf/helpers';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const splitGeoJSON = require('geojson-antimeridian-cut');




import { haversine, triplicateGeoJSON, unwrapPath, normalizePair } from './utils/geo.js';

// import network from '../data/networks/ornl.geojson';
// import { haversine } from './utils/geo.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import length from '@turf/length';

import util from 'util'; // Used for debugging

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


export class SeaRouteCH {
  constructor() {
    this.network = null;
    this.graph = null;
    this.finder = null;
    this.lookup = null;
    this.init();
  }

  loadNetwork(networkName) {
    try {
      const networkPath = join(__dirname, '..', 'data', 'networks', `${networkName}.geojson`);
      const data = readFileSync(networkPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to load default network '${networkName}': ${error.message}`);
    }
  }

  init() {
    this.network = this.loadNetwork('eurostat');
    this.triplicated = triplicateGeoJSON(this.network);
    let i = 1;
    for (const feature of this.triplicated.features) {
      const distKm = length(feature, { units: 'kilometers' });
      feature.properties._cost = distKm;
      feature.properties._id = i++;

      if (feature.properties.fid === 85148) {
        console.log('Feature 85148:', util.inspect(feature, {
          depth: null,
          colors: false,
          maxArrayLength: null,
        }));
      }
    }
    // console.log('%o', this.network);

    /* const graph = new Graph(this.triplicated, { debugMode: true });
    console.time('Contracting graph');
    graph.contractGraph();
    console.timeEnd('Contracting graph');
    graph.savePbfCH('eurostat.pbf');
    console.time('Loading PBF CH graph'); */
    const buffer = readFileSync('eurostat.pbf');
    this.graph = new Graph();
    this.graph.loadPbfCH(buffer);
    console.timeEnd('Loading PBF CH graph');

    this.finder = this.graph.createPathfinder({
      ids: true,
      path: true,
      nodes: true,
      properties: true,
    });

    this.lookup = new CoordinateLookup(this.graph);

    this.findRoute();


  }

  /**
   * Format path geometry for output, handling antimeridian crossing
   * @private
   * @param {Array} pathCoordinates - Array of coordinate pairs from pathfinder result
   * @param {Object} [properties={}] - Properties to attach to the GeoJSON LineString
   * @returns {Object} GeoJSON geometry split at antimeridian if necessary
   */
  formatPathGeometry(geojson, properties = {}) {
    const pathCoordinates = [];
    coordEach(geojson, (coord) => {
      pathCoordinates.push(coord);
    });
    const unwrapped = unwrapPath(pathCoordinates);
    if (unwrapped.length < 2) return null;
    const line = lineString(unwrapped, properties);
    const splittedGeoJSON = splitGeoJSON(line);
    return splittedGeoJSON;


    // return splitGeoJSON(line);
  }


  findRoute(start, end) {
    // Find closest network points
    // getClosestNetworkPt


    const startPt = this.lookup.getClosestNetworkPt(-123.1203, 49.2705);
    const endPt = this.lookup.getClosestNetworkPt(117.7006, 38.9847);


    console.log(startPt, endPt);

    const [A, B] = normalizePair(startPt, endPt);


    // Use these points for pathfinding
    console.time('start finder');
    const path = this.finder.queryContractionHierarchy(A, B);
    console.timeEnd('start finder');


    const geojson = this.formatPathGeometry(path.path, path);

    // Debugging: uncomment util import above
    /*console.log(util.inspect(path.path, {
      depth: null,
      colors: false,
      maxArrayLength: null,
    })); */
    console.log(path);
    console.log(JSON.stringify(geojson));

  }

}

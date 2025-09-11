/**
 * @fileoverview Data utility functions for loading and processing JSON/GeoJSON files
 * @author Stephan Georg
 * @version 1.0.0
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Generic JSON object type
 * @typedef {Object.<string, any>} JsonObject
 */

/**
 * GeoJSON Feature object
 * @typedef {Object} GeoJSONFeature
 * @property {string} type - Always "Feature"
 * @property {Object} geometry - The geometry object
 * @property {string} geometry.type - Geometry type (Point, LineString, Polygon, etc.)
 * @property {Array<number>|Array<Array<number>>|Array<Array<Array<number>>>} geometry.coordinates - Coordinate array
 * @property {Object} properties - Feature properties
 * @property {string|number} [properties.id] - Optional feature identifier
 */

/**
 * GeoJSON FeatureCollection object
 * @typedef {Object} GeoJSONFeatureCollection
 * @property {string} type - Always "FeatureCollection"
 * @property {Array<GeoJSONFeature>} features - Array of GeoJSON features
 * @property {Object} [metadata] - Optional metadata object
 * @property {string} [metadata.version] - Data version
 * @property {string} [metadata.lastUpdated] - Last update timestamp
 * @property {string} [metadata.source] - Data source information
 * @property {number} [metadata.totalRoutes] - Total number of routes
 * @property {string} [metadata.coverage] - Coverage area description
 */

/**
 * Vessel class definitions based on maritime passage rules
 * @typedef {'panamax'|'vlcc'|'ulcv'} VesselClass
 * - panamax: Panamax (≤80k DWT, ~≤12m draft)
 * - vlcc: Very Large Crude Carrier (200–320k DWT, ~20–22m draft)
 * - ulcv: Ultra Large Container Vessel (14k–24k TEU, ~14–16m draft)
 */

/**
 * Passage status for different vessel classes
 * @typedef {'allowed'|'restricted'|'forbidden'} PassageStatus
 */

/**
 * Risk group categories for maritime passages
 * @typedef {string} RiskGroup
 * Security risks: 'red_sea_conflict', 'piracy_gulf_of_aden', 'piracy_somalia', 'persian_gulf_tension', 'black_sea_conflict'
 * Environmental risks: 'arctic_ice', 'seasonal_fog', 'monsoon_weather'
 * Traffic risks: 'chokepoint_congestion', 'traffic_density', 'pilotage_weather', 'shallow_draft_limit'
 * Infrastructure risks: 'panama_drought', 'suez_blockage', 'canal_maintenance'
 * Regulatory risks: 'regulatory', 'sanctions', 'montreux_convention'
 */

/**
 * Maritime passage configuration
 * @typedef {Object} MaritimePassage
 * @property {'canal'|'strait'|'route'} kind - Type of passage
 * @property {Object.<VesselClass, PassageStatus>} status - Status per vessel class
 * @property {Array<RiskGroup>} risk_group - Associated risk groups
 * @property {Array<number>} feature_ids - GeoJSON feature IDs for this passage
 * @property {string} notes - Additional information about the passage
 */

/**
 * Time window for temporary overrides
 * @typedef {Object} TimeWindow
 * @property {string} start - Start date (ISO format)
 * @property {string} end - End date (ISO format)
 */

/**
 * Override action for passage rules
 * @typedef {Object} OverrideAction
 * @property {'set_status'} type - Action type
 * @property {string} passage_id - Target passage identifier
 * @property {Object.<VesselClass, PassageStatus>} status - New status per vessel class
 */

/**
 * Temporary rule override
 * @typedef {Object} RuleOverride
 * @property {string} id - Override identifier
 * @property {string} description - Human-readable description
 * @property {boolean} active - Whether override is currently active
 * @property {TimeWindow} [window] - Time window when override applies
 * @property {RiskGroup} [when_risk_group_active] - Risk group that triggers this override
 * @property {Array<OverrideAction>} actions - Actions to perform when override is active
 */

/**
 * Complete maritime passage rules configuration
 * @typedef {Object} MaritimePassageRules
 * @property {number} version - Rules version number
 * @property {string} updated - Last update date
 * @property {Object.<VesselClass, string>} classes - Vessel class descriptions
 * @property {'allowed'|'restricted'|'forbidden'} default_policy - Default passage policy
 * @property {Object.<RiskGroup, string>} risk_groups - Risk group descriptions
 * @property {Object.<string, MaritimePassage>} passages - Passage configurations
 * @property {Array<RuleOverride>} overrides - Temporary rule overrides
 */

/**
 * Vessel profile configuration (updated for maritime passage rules)
 * @typedef {Object} VesselProfile
 * @property {string} profile - Profile identifier
 * @property {string} version - Profile version
 * @property {string} description - Profile description
 * @property {VesselClass} vesselClass - Vessel class (panamax, vlcc, ulcv)
 * @property {Object} vessel - Vessel specifications
 * @property {string} vessel.type - Vessel type (e.g., "Container Ship", "Bulk Carrier")
 * @property {number} vessel.length - Vessel length in meters
 * @property {number} vessel.beam - Vessel beam in meters
 * @property {number} vessel.draft - Vessel draft in meters
 * @property {number} vessel.dwt - Deadweight tonnage
 * @property {number} vessel.cruisingSpeed - Cruising speed in knots
 * @property {Object} routing - Routing configuration
 * @property {Array<string>} routing.allowedPassages - Allowed passage identifiers
 * @property {Array<string>} routing.forbiddenPassages - Forbidden passage identifiers
 * @property {Array<RiskGroup>} routing.acceptableRisks - Acceptable risk groups
 * @property {PassageStatus} routing.defaultPolicy - Default policy for unspecified passages
 * @property {Object} restrictions - Route restrictions
 * @property {number} restrictions.maxDraft - Maximum draft in meters
 * @property {number} restrictions.maxBeam - Maximum beam in meters
 * @property {number} restrictions.maxLength - Maximum length in meters
 * @property {Array<string>} restrictions.forbiddenAreas - Forbidden area identifiers
 * @property {Object} preferences - Routing preferences
 * @property {string} preferences.routeType - Preferred route type ("shortest", "fastest", "economical")
 * @property {number} preferences.weatherWeight - Weather consideration weight (0-1)
 * @property {number} preferences.fuelWeight - Fuel efficiency weight (0-1)
 * @property {number} preferences.riskTolerance - Risk tolerance level (0-1)
 * @property {Object} costs - Cost configuration
 * @property {number} costs.fuelCostPerTon - Fuel cost per ton
 * @property {number} costs.portCharges - Port charges
 * @property {number} costs.canalFees - Canal transit fees
 * @property {number} costs.riskPremium - Risk premium factor
 */

/**
 * File loading error with additional context
 * @typedef {Error} FileLoadError
 * @property {string} name - Error name
 * @property {string} message - Error message
 * @property {string} [code] - Error code (e.g., 'ENOENT', 'EACCES')
 * @property {string} [path] - File path that caused the error
 * @property {string} [errno] - System error number
 */

/**
 * Loads and parses a JSON file from a relative path
 * @param {string} filePath - Relative file path from the utils directory
 * @returns {JsonObject|GeoJSONFeatureCollection|VesselProfile|MaritimePassageRules|Array<any>} Parsed JSON content
 * @throws {FileLoadError} When file path is empty, file doesn't exist, or JSON is invalid
 * @example
 * // Load a GeoJSON network file
 * const network = loadJsonFile('../../data/networks/global.geojson');
 *
 * @example
 * // Load a vessel profile
 * const profile = loadJsonFile('../../data/profiles/container.json');
 *
 * @example
 * // Load maritime passage rules
 * const rules = loadJsonFile('../../data/profiles/maritime_passage_rules_v1.json');
 *
 * @example
 * // Error handling
 * try {
 *   const data = loadJsonFile('../../data/missing.json');
 * } catch (error) {
 *   if (error.code === 'ENOENT') {
 *     console.error('File not found:', error.path);
 *   }
 * }
 */
export const loadJsonFile = (filePath = '') => {
  if (!filePath) {
    throw new Error('File path is required');
  }

  try {
    // Get the directory of the current module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Construct absolute path and load JSON data
    const absolutePath = join(__dirname, filePath);
    const jsonContent = readFileSync(absolutePath, 'utf8');
    const json = JSON.parse(jsonContent);

    return json;
  } catch (/** @type {any} */ error) {
    // Enhance error with file path information
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in file: ${filePath}. ${error.message}`);
    }
    throw new Error(`Failed to load file: ${filePath}. ${error.message}`);
  }
};




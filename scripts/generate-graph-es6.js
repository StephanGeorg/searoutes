#!/usr/bin/env node

/**
 * SeaRoutes Graph Generator
 *
 * CLI script to generate Contraction Hierarchy graphs from GeoJSON maritime networks
 * with support for vessel-specific routing profiles and passage restrictions.
 *
 * Features:
 * - Basic distance-based pathfinding
 * - Maritime profile-aware routing (Panamax, VLCC, ULCV)
 * - Custom passage restrictions and risk assessments
 * - Batch generation for multiple profiles
 *
 * @author Stephan Georg
 * @version 2.0.0
 * @since 2025-12-29
 */

import { Graph } from 'contraction-hierarchy-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, basename, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import length from '@turf/length';

// Module path resolution for ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration constants
const DEFAULT_RESTRICTED_MULTIPLIER = 1.25;
const DEFAULT_PROFILE = 'basic';
const SUPPORTED_FILE_EXTENSION = '.geojson';
/**
 * Dynamically import required dependencies and default maritime profiles
 *
 * @async
 * @function importDependencies
 * @returns {Promise<Object>} Object containing all required utilities and default profiles
 * @returns {Function} returns.triplicateGeoJSON - GeoJSON antimeridian handling utility
 * @returns {Function} returns.haversine - Distance calculation function
 * @returns {Function} returns.computeEffectiveStatusNoOverrides - Profile status computation
 * @returns {Function} returns.collectClassEdgeRules - Edge restriction rule collection
 * @returns {Function} returns.makeWeightFn - Weight function factory
 * @returns {Object} returns.defaultProfiles - Default maritime profiles configuration
 */
async function importDependencies() {
  const moduleDir = resolve(__dirname, '..');

  // Import geometric utilities for distance and coordinate handling
  const { triplicateGeoJSON, haversine } = await import(join(moduleDir, 'src/utils/geo.js'));

  // Import maritime profile processing utilities
  const { computeEffectiveStatusNoOverrides, collectClassEdgeRules, makeWeightFn } =
    await import(join(moduleDir, 'src/utils/profiles.js'));

  // Load default maritime profiles configuration
  const profilesPath = join(moduleDir, 'data/profiles/default_v1.json');
  const profilesData = readFileSync(profilesPath, 'utf-8');
  const defaultProfiles = JSON.parse(profilesData);

  return {
    triplicateGeoJSON,
    haversine,
    computeEffectiveStatusNoOverrides,
    collectClassEdgeRules,
    makeWeightFn,
    defaultProfiles,
  };
}

/**
 * Display comprehensive help information for the CLI tool
 *
 * @function showHelp
 */
function showHelp() {
  console.log(`
📊 SeaRoutes Graph Generator
`);
  console.log('Generate Contraction Hierarchy graphs from GeoJSON maritime networks\n');

  console.log('USAGE:');
  console.log('  node scripts/generate-graph-es6.js <input-file> [output-file] [options]\n');

  console.log('ARGUMENTS:');
  console.log('  input-file   Path to GeoJSON network file (required)');
  console.log('  output-file  Output path for .pbf graph file (optional)\n');

  console.log('OPTIONS:');
  console.log('  --profile <name>    Generate graph for specific maritime profile (default: basic)');
  console.log('  --all-profiles      Generate graphs for all available maritime profiles');
  console.log('  --list-profiles     List all available maritime profiles');
  console.log('  --profiles <file>   Use custom maritime profiles from JSON file');
  console.log('  --debug, -d         Enable debug mode with detailed logging\n');

  console.log('EXAMPLES:');
  console.log('  # Basic graph generation');
  console.log('  node scripts/generate-graph-es6.js data/networks/eurostat.geojson');
  console.log('');
  console.log('  # Generate for specific vessel type');
  console.log('  node scripts/generate-graph-es6.js eurostat.geojson --profile panamax');
  console.log('');
  console.log('  # Generate all available profiles');
  console.log('  node scripts/generate-graph-es6.js eurostat.geojson --all-profiles');
  console.log('');
  console.log('  # Use custom maritime profiles');
  console.log('  node scripts/generate-graph-es6.js eurostat.geojson --profiles custom.json');
  console.log('');
  console.log('  # Debug mode with custom output');
  console.log('  node scripts/generate-graph-es6.js eurostat.geojson graphs/custom.pbf --debug\n');
}

/**
 * Parse command line arguments into configuration options
 *
 * @function parseArgs
 * @param {string[]} args - Process command line arguments
 * @returns {Object} Parsed configuration options
 * @returns {string} returns.inputFile - Path to input GeoJSON file
 * @returns {string|null} returns.outputFile - Custom output file path
 * @returns {string} returns.profile - Target vessel profile name
 * @returns {boolean} returns.allProfiles - Generate all available profiles
 * @returns {boolean} returns.listProfiles - List available profiles and exit
 * @returns {string|null} returns.customProfiles - Path to custom profiles file
 * @returns {boolean} returns.debugMode - Enable debug logging
 */
function parseArgs(args) {
  // Initialize default options
  const options = {
    inputFile: args[2],
    outputFile: null,
    profile: DEFAULT_PROFILE,
    allProfiles: false,
    listProfiles: false,
    customProfiles: null,
    debugMode: false,
  };

  // Parse command line flags and arguments
  for (let i = 3; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
    case '--profile':
      if (args[i + 1]) {
        options.profile = args[i + 1];
        i++; // Skip the profile name argument
      }
      break;

    case '--all-profiles':
      options.allProfiles = true;
      break;

    case '--list-profiles':
      options.listProfiles = true;
      break;

    case '--profiles':
      if (args[i + 1]) {
        options.customProfiles = args[i + 1];
        i++; // Skip the profiles file path argument
      }
      break;

    case '--debug':
    case '-d':
      options.debugMode = true;
      break;

    default:
      // Capture output file if it doesn't start with -- and no output file is set yet
      if (!arg.startsWith('--') && !options.outputFile) {
        options.outputFile = arg;
      }
      break;
    }
  }

  return options;
}

/**
 * Validate command line arguments and input file
 *
 * @function validateArgs
 * @param {Object} options - Parsed command line options
 * @throws {Error} Exits process if validation fails
 */
function validateArgs(options) {
  // Check if input file is provided
  if (!options.inputFile) {
    console.error('❌ Error: Input file is required\n');
    showHelp();
    process.exit(1);
  }

  // Verify input file exists
  if (!existsSync(options.inputFile)) {
    console.error(`❌ Error: Input file '${options.inputFile}' does not exist\n`);
    process.exit(1);
  }

  // Warn if file extension is not .geojson
  if (extname(options.inputFile).toLowerCase() !== SUPPORTED_FILE_EXTENSION) {
    console.warn(`⚠️  Warning: Input file '${options.inputFile}' is not a ${SUPPORTED_FILE_EXTENSION} file`);
  }
}

/**
 * Load maritime profiles from custom file or use defaults
 *
 * @function loadProfiles
 * @param {string|null} customProfilesPath - Path to custom profiles JSON file
 * @param {Object} defaultProfiles - Default profiles as fallback
 * @returns {Object} Maritime profiles configuration
 * @throws {Error} Exits process if custom profiles file doesn't exist
 */
function loadProfiles(customProfilesPath, defaultProfiles) {
  if (customProfilesPath) {
    // Validate custom profiles file exists
    if (!existsSync(customProfilesPath)) {
      console.error(`❌ Error: Custom profiles file '${customProfilesPath}' does not exist\n`);
      process.exit(1);
    }

    console.log(`📋 Loading custom profiles from: ${customProfilesPath}`);

    try {
      const customData = readFileSync(customProfilesPath, 'utf-8');
      return JSON.parse(customData);
    } catch (error) {
      console.error(`❌ Error parsing custom profiles: ${error.message}\n`);
      process.exit(1);
    }
  }

  console.log('📋 Using default maritime profiles');
  return defaultProfiles;
}

/**
 * Display all available maritime profiles
 *
 * @function listProfiles
 * @param {Object} profiles - Maritime profiles configuration
 */
function listProfiles(profiles) {
  console.log('\n🚢 Available Maritime Profiles:');

  // Always show basic profile
  console.log('  basic      - Basic pathfinding without vessel restrictions');

  // Show vessel-specific profiles if available
  if (profiles && profiles.classes) {
    const classes = Object.keys(profiles.classes);

    for (const className of classes) {
      const description = profiles.classes[className];
      const paddedName = className.padEnd(10);
      console.log(`  ${paddedName} - ${description}`);
    }
  }

  console.log('');
}

/**
 * Build maritime pathfinder weight function for a specific vessel class
 *
 * This function creates a weight function that applies vessel-specific routing
 * restrictions and cost multipliers based on maritime passage rules.
 *
 * @function buildMaritimeWeights
 * @param {Object} profiles - Maritime profiles configuration
 * @param {string} vesselClass - Target vessel class (e.g., 'panamax', 'vlcc', 'ulcv')
 * @param {Object} helpers - Utility functions for profile processing
 * @param {Object} options - Additional configuration options
 * @param {number} options.restrictedMultiplier - Cost multiplier for restricted passages
 * @returns {Function} Weight function for graph construction
 * @throws {Error} If vessel class is not found in profiles
 */
function buildMaritimeWeights(profiles, vesselClass, helpers, options = {}) {
  const { restrictedMultiplier = DEFAULT_RESTRICTED_MULTIPLIER } = options;

  // Validate profiles configuration
  const classes = Object.keys(profiles.classes || {});
  if (classes.length === 0) {
    throw new Error('profiles.classes is empty. Add at least one vessel class.');
  }

  // Validate requested vessel class exists
  if (!classes.includes(vesselClass)) {
    throw new Error(
      `Vessel class '${vesselClass}' not found in profiles. Available: ${classes.join(', ')}`,
    );
  }

  // Compute effective passage status for all vessel classes
  const effective = helpers.computeEffectiveStatusNoOverrides(profiles, classes);

  // Collect edge rules (forbidden/restricted passages) for each class
  const rules = helpers.collectClassEdgeRules(effective, classes);

  // Create weight function with vessel-specific restrictions
  return helpers.makeWeightFn(
    vesselClass,
    rules,
    restrictedMultiplier,
    helpers.haversine,
  );
}

/**
 * Generate a complete graph for a specific profile
 *
 * This function orchestrates the entire graph generation process:
 * 1. Load and preprocess the network
 * 2. Build the graph with appropriate weight function
 * 3. Save the graph to file
 *
 * @async
 * @function generateGraph
 * @param {Object} options - Generation options
 * @param {string} options.inputFile - Input GeoJSON file path
 * @param {string} options.profile - Target vessel profile
 * @param {boolean} options.debugMode - Enable debug logging
 * @param {string|null} options.outputFile - Custom output file path
 * @param {Object} helpers - Utility functions and profiles
 * @returns {Promise<string>} Path to generated graph file
 */
async function generateGraph(options, helpers) {
  const { inputFile, profile, debugMode } = options;

  // Step 1: Load and validate network data
  const network = loadNetwork(inputFile);

  // Step 2: Preprocess network for graph construction
  const processedNetwork = preprocessNetwork(network, helpers.triplicateGeoJSON);

  // Step 3: Build graph with profile-specific routing
  const graph = buildGraph(processedNetwork, profile, helpers, debugMode);

  // Step 4: Generate appropriate output file path
  const outputFile = generateOutputPath(inputFile, options.outputFile, profile);

  // Step 5: Save graph to Protocol Buffer format
  saveGraph(graph, outputFile);

  return outputFile;
}

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

/**
 * Generate appropriate output file path based on input file and profile
 */
function generateOutputPath(inputFile, customOutput, profile = DEFAULT_PROFILE) {
  if (customOutput) {
    return customOutput;
  }

  const baseName = basename(inputFile, extname(inputFile));
  return profile === DEFAULT_PROFILE ? `${baseName}.pbf` : `${baseName}-${profile}.pbf`;
}

/**
 * Load and validate GeoJSON network from file
 */
function loadNetwork(inputFile) {
  console.log(`📁 Loading network from: ${inputFile}`);

  try {
    const data = readFileSync(inputFile, 'utf-8');
    const network = JSON.parse(data);

    if (!network.type || network.type !== 'FeatureCollection') {
      throw new Error('Input must be a GeoJSON FeatureCollection');
    }

    if (!network.features || !Array.isArray(network.features) || network.features.length === 0) {
      throw new Error('Network must contain at least one feature');
    }

    console.log(`✅ Loaded ${network.features.length} features`);
    return network;
  } catch (error) {
    console.error(`❌ Error loading network: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Preprocess GeoJSON network for graph construction
 */
function preprocessNetwork(network, triplicateGeoJSON) {
  console.log('🔄 Preprocessing network...');

  console.time('⏱️  Triplicating GeoJSON');
  const triplicated = triplicateGeoJSON(network);
  console.timeEnd('⏱️  Triplicating GeoJSON');

  console.log(`📈 Triplicated network has ${triplicated.features.length} features`);
  console.log('💰 Adding cost properties...');

  triplicated.features.forEach((feature, index) => {
    const distKm = length(feature, { units: 'kilometers' });
    feature.properties._cost = distKm;
    feature.properties._id = index + 1;
  });

  console.log('✅ Preprocessing completed');
  return triplicated;
}

/**
 * Build Contraction Hierarchy graph with profile-specific weight function
 */
function buildGraph(network, profile, helpers, debugMode = false) {
  console.log(`🏗️  Building Contraction Hierarchy graph for profile: ${profile}`);

  console.time('⏱️  Graph construction');

  let weightFunction;

  if (profile === DEFAULT_PROFILE) {
    console.log('🗺️  Using basic distance-based routing');
    weightFunction = (coordinateA, coordinateB) => Math.trunc(helpers.haversine(coordinateA, coordinateB));
  } else {
    console.log(`🚢  Using maritime profile routing for: ${profile}`);
    const profiles = helpers.profiles || helpers.defaultProfiles;
    weightFunction = buildMaritimeWeights(profiles, profile, helpers, { restrictedMultiplier: DEFAULT_RESTRICTED_MULTIPLIER });
  }

  const graph = new Graph(network, { debugMode, weight: weightFunction });
  console.timeEnd('⏱️  Graph construction');

  console.time('⏱️  Contracting graph');
  graph.contractGraph();
  console.timeEnd('⏱️  Contracting graph');

  console.log('✅ Graph construction completed');
  return graph;
}

/**
 * Save constructed graph to Protocol Buffer format (.pbf)
 */
function saveGraph(graph, outputFile) {
  console.log(`💾 Saving graph to: ${outputFile}`);

  try {
    console.time('⏱️  Saving graph');
    graph.savePbfCH(outputFile);
    console.timeEnd('⏱️  Saving graph');
    console.log(`✅ Graph saved successfully: ${outputFile}`);
  } catch (error) {
    console.error(`❌ Error saving graph: ${error.message}`);
    process.exit(1);
  }
}
/**
 * Generate graphs for all available profiles (basic + maritime classes)
 *
 * @async
 * @function generateAllProfiles
 * @param {Object} options - Generation options
 * @param {Object} helpers - Utility functions and profiles
 * @param {Object} profiles - Maritime profiles configuration
 */
async function generateAllProfiles(options, helpers, profiles) {
  console.log('🔄 Generating graphs for all profiles...\n');

  const results = [];

  try {
    // Generate basic graph
    console.log('📊 Generating basic graph...');
    const basicResult = await generateGraph(
      { ...options, profile: DEFAULT_PROFILE },
      helpers,
    );
    results.push({ profile: DEFAULT_PROFILE, output: basicResult });
    console.log('');

    // Generate graphs for all maritime profiles
    if (profiles && profiles.classes) {
      const classes = Object.keys(profiles.classes);

      for (const className of classes) {
        console.log(`📊 Generating graph for profile: ${className}...`);

        try {
          const result = await generateGraph(
            { ...options, profile: className },
            helpers,
          );
          results.push({ profile: className, output: result });
        } catch (error) {
          console.error(`❌ Failed to generate graph for ${className}: ${error.message}`);
          if (options.debugMode) {
            console.error(error.stack);
          }
        }

        console.log('');
      }
    }

    // Display summary
    console.timeEnd('⏱️  Total generation time');
    console.log('\n📋 Generated Graphs Summary:');

    for (const result of results) {
      const paddedProfile = result.profile.padEnd(12);
      console.log(`  ${paddedProfile} → ${result.output}`);
    }

    console.log(`\n🎉 Successfully generated ${results.length} graphs!`);

  } catch (error) {
    console.error('\n❌ Error during batch generation');
    throw error;
  }
}

/**
 * Generate a single graph for the specified profile
 *
 * @async
 * @function generateSingleProfile
 * @param {Object} options - Generation options
 * @param {Object} helpers - Utility functions and profiles
 * @param {Object} profiles - Maritime profiles configuration
 */
async function generateSingleProfile(options, helpers, profiles) {
  // Validate that the requested profile exists
  if (options.profile !== DEFAULT_PROFILE && profiles && profiles.classes) {
    const classes = Object.keys(profiles.classes);

    if (!classes.includes(options.profile)) {
      console.error(`❌ Error: Profile '${options.profile}' not found.`);
      console.log('\nAvailable profiles:');
      console.log(`  - ${DEFAULT_PROFILE} (basic pathfinding)`);

      for (const className of classes) {
        console.log(`  - ${className}`);
      }

      process.exit(1);
    }
  }

  // Generate the graph
  const outputFile = await generateGraph(options, helpers);

  // Display results
  console.timeEnd('⏱️  Total generation time');
  console.log(`\nProfile: ${options.profile}`);
  console.log(`Output:  ${outputFile}`);
  console.log('\n🎉 Graph generation completed successfully!');
}

/**
 * Main entry point for the CLI application
 *
 * Handles command line parsing, profile loading, and orchestrates
 * the graph generation process for single or multiple profiles.
 *
 * @async
 * @function main
 */
async function main() {
  const args = process.argv;
  let options;

  // Handle help request
  if (args.includes('-h') || args.includes('--help')) {
    showHelp();
    return;
  }

  try {
    // Step 1: Parse and validate command line arguments
    options = parseArgs(args);

    // Step 2: Load required dependencies and utilities
    const helpers = await importDependencies();

    // Step 3: Load maritime profiles (default or custom)
    const profiles = loadProfiles(options.customProfiles, helpers.defaultProfiles);
    helpers.profiles = profiles;

    // Step 4: Handle profile listing request
    if (options.listProfiles) {
      listProfiles(profiles);
      return;
    }

    // Step 5: Validate input arguments
    validateArgs(options);

    // Display generation summary
    console.log('🚢 SeaRoutes Graph Generator\n');
    console.log(`Input:  ${options.inputFile}`);
    console.log(`Debug:  ${options.debugMode ? 'enabled' : 'disabled'}\n`);

    console.time('⏱️  Total generation time');

    if (options.allProfiles) {
      // Generate graphs for all available profiles
      await generateAllProfiles(options, helpers, profiles);
    } else {
      // Generate single graph for specified profile
      await generateSingleProfile(options, helpers, profiles);
    }

  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    if (options && options.debugMode) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };

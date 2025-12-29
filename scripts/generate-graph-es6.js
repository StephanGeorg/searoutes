#!/usr/bin/env node

import { Graph } from 'contraction-hierarchy-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, basename, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import length from '@turf/length';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * CLI script to generate Contraction Hierarchy graph from GeoJSON network with maritime profiles
 * Usage: node scripts/generate-graph.js <input-file> [output-file] [options]
 */
async function importDependencies() {
  // Import dependencies with proper path resolution
  const moduleDir = resolve(__dirname, '..');
  const { triplicateGeoJSON, haversine } = await import(join(moduleDir, 'src/utils/geo.js'));
  const { computeEffectiveStatusNoOverrides, collectClassEdgeRules, makeWeightFn } = await import(join(moduleDir, 'src/utils/profiles.js'));

  // Import default profiles
  const profilesPath = join(moduleDir, 'data/profiles/default_v1.json');
  const profilesData = readFileSync(profilesPath, 'utf-8');
  const defaultProfiles = JSON.parse(profilesData);

  return { triplicateGeoJSON, haversine, computeEffectiveStatusNoOverrides, collectClassEdgeRules, makeWeightFn, defaultProfiles };
}

function showHelp() {
  console.log(`
📊 SeaRoutes Graph Generator
  `);
  console.log('Generate Contraction Hierarchy graph from GeoJSON network\n');
  console.log('Usage:');
  console.log('  node scripts/generate-graph.js <input-file> [output-file] [options]\n');
  console.log('Arguments:');
  console.log('  input-file   Path to GeoJSON network file (required)');
  console.log('  output-file  Output path for .pbf graph file (optional)\n');
  console.log('Options:');
  console.log('  --profile <name>    Generate graph for specific maritime profile (default: basic)');
  console.log('  --all-profiles      Generate graphs for all available maritime profiles');
  console.log('  --list-profiles     List all available maritime profiles');
  console.log('  --profiles <file>   Use custom maritime profiles from JSON file');
  console.log('  --debug, -d         Enable debug mode\n');
  console.log('Examples:');
  console.log('  node scripts/generate-graph.js data/networks/eurostat.geojson');
  console.log('  node scripts/generate-graph.js eurostat.geojson --profile panamax');
  console.log('  node scripts/generate-graph.js eurostat.geojson --all-profiles');
  console.log('  node scripts/generate-graph.js eurostat.geojson --list-profiles');
  console.log('  node scripts/generate-graph.js eurostat.geojson graphs/custom.pbf --debug\n');
}

function parseArgs(args) {
  const options = {
    inputFile: args[2],
    outputFile: null,
    profile: 'basic',
    allProfiles: false,
    listProfiles: false,
    customProfiles: null,
    debugMode: false,
  };

  for (let i = 3; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--profile' && args[i + 1]) {
      options.profile = args[i + 1];
      i++; // Skip next arg
    } else if (arg === '--all-profiles') {
      options.allProfiles = true;
    } else if (arg === '--list-profiles') {
      options.listProfiles = true;
    } else if (arg === '--profiles' && args[i + 1]) {
      options.customProfiles = args[i + 1];
      i++; // Skip next arg
    } else if (arg === '--debug' || arg === '-d') {
      options.debugMode = true;
    } else if (!arg.startsWith('--') && !options.outputFile) {
      options.outputFile = arg;
    }
  }

  return options;
}

function validateArgs(options) {
  if (!options.inputFile) {
    console.error('❌ Error: Input file is required\n');
    showHelp();
    process.exit(1);
  }

  if (!existsSync(options.inputFile)) {
    console.error(`❌ Error: Input file '${options.inputFile}' does not exist\n`);
    process.exit(1);
  }

  if (extname(options.inputFile).toLowerCase() !== '.geojson') {
    console.warn(`⚠️  Warning: Input file '${options.inputFile}' is not a .geojson file`);
  }
}

function loadProfiles(customProfilesPath, defaultProfiles) {
  if (customProfilesPath) {
    if (!existsSync(customProfilesPath)) {
      console.error(`❌ Error: Custom profiles file '${customProfilesPath}' does not exist\n`);
      process.exit(1);
    }
    console.log(`📋 Loading custom profiles from: ${customProfilesPath}`);
    const customData = readFileSync(customProfilesPath, 'utf-8');
    return JSON.parse(customData);
  }

  console.log('📋 Using default maritime profiles');
  return defaultProfiles;
}

function listProfiles(profiles) {
  console.log('\n🚢 Available Maritime Profiles:');
  console.log('  basic      - Basic pathfinding without vessel restrictions');

  if (profiles && profiles.classes) {
    const classes = Object.keys(profiles.classes);
    for (const className of classes) {
      const description = profiles.classes[className];
      console.log(`  ${className.padEnd(10)} - ${description}`);
    }
  }
  console.log('');
}

function generateOutputPath(inputFile, customOutput, profile = 'basic') {
  if (customOutput) {
    return customOutput;
  }

  const baseName = basename(inputFile, extname(inputFile));
  if (profile === 'basic') {
    return `${baseName}.pbf`;
  } else {
    return `${baseName}-${profile}.pbf`;
  }
}

function loadNetwork(inputFile) {
  console.log(`📁 Loading network from: ${inputFile}`);

  try {
    const data = readFileSync(inputFile, 'utf-8');
    const network = JSON.parse(data);

    if (!network.type || network.type !== 'FeatureCollection') {
      throw new Error('Input must be a GeoJSON FeatureCollection');
    }

    if (!network.features || network.features.length === 0) {
      throw new Error('Network must contain at least one feature');
    }

    console.log(`✅ Loaded ${network.features.length} features`);
    return network;
  } catch (error) {
    console.error(`❌ Error loading network: ${error.message}`);
    process.exit(1);
  }
}

function preprocessNetwork(network, triplicateGeoJSON) {
  console.log('🔄 Preprocessing network...');

  // Triplicate GeoJSON for antimeridian handling
  console.time('⏱️  Triplicating GeoJSON');
  const triplicated = triplicateGeoJSON(network);
  console.timeEnd('⏱️  Triplicating GeoJSON');

  console.log(`📈 Triplicated network has ${triplicated.features.length} features`);

  // Add cost properties to features
  console.log('💰 Adding cost properties...');
  let i = 1;
  for (const feature of triplicated.features) {
    const distKm = length(feature, { units: 'kilometers' });
    feature.properties._cost = distKm;
    feature.properties._id = i++;
  }

  console.log('✅ Preprocessing completed');
  return triplicated;
}

/**
 * Build maritime pathfinder weights for a specific vessel class
 * (Adapted from SeaRoutes.js buildMaritimePathfinders method)
 */
function buildMaritimeWeights(
  profiles,
  vesselClass,
  helpers, // { haversine, computeEffectiveStatusNoOverrides, collectClassEdgeRules, makeWeightFn }
  options = {},
) {
  const { restrictedMultiplier = 1.25 } = options;

  const classes = Object.keys(profiles.classes || {});
  if (classes.length === 0) {
    throw new Error('profiles.classes is empty. Add at least one vessel class.');
  }

  if (!classes.includes(vesselClass)) {
    throw new Error(`Vessel class '${vesselClass}' not found in profiles. Available: ${classes.join(', ')}`);
  }

  const effective = helpers.computeEffectiveStatusNoOverrides(profiles, classes);
  const rules = helpers.collectClassEdgeRules(effective, classes);

  const weightFn = helpers.makeWeightFn(vesselClass, rules, restrictedMultiplier, helpers.haversine);

  return weightFn;
}

function buildGraph(network, profile, helpers, debugMode = false) {
  console.log(`🏗️  Building Contraction Hierarchy graph for profile: ${profile}`);

  console.time('⏱️  Graph construction');

  let weightFn;

  if (profile === 'basic') {
    // Basic distance-based weight function
    weightFn = (a, b) => Math.trunc(helpers.haversine(a, b));
  } else {
    // Maritime profile with vessel restrictions
    const profiles = helpers.profiles || helpers.defaultProfiles;
    weightFn = buildMaritimeWeights(profiles, profile, helpers, { restrictedMultiplier: 1.25 });
  }

  const graph = new Graph(network, { debugMode, weight: weightFn });
  console.timeEnd('⏱️  Graph construction');

  console.time('⏱️  Contracting graph');
  graph.contractGraph();
  console.timeEnd('⏱️  Contracting graph');

  console.log('✅ Graph construction completed');
  return graph;
}

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

async function generateGraph(options, helpers) {
  const { inputFile, profile, debugMode } = options;

  // Load and preprocess network
  const network = loadNetwork(inputFile);
  const processedNetwork = preprocessNetwork(network, helpers.triplicateGeoJSON);

  // Build graph for specific profile
  const graph = buildGraph(processedNetwork, profile, helpers, debugMode);

  // Generate output path
  const outputFile = generateOutputPath(inputFile, options.outputFile, profile);

  // Save graph
  saveGraph(graph, outputFile);

  return outputFile;
}

async function main() {
  const args = process.argv;

  // Show help if requested
  if (args.includes('-h') || args.includes('--help')) {
    showHelp();
    return;
  }

  // Parse command line arguments
  const options = parseArgs(args);

  // Import dependencies
  const helpers = await importDependencies();

  // Load profiles
  const profiles = loadProfiles(options.customProfiles, helpers.defaultProfiles);
  helpers.profiles = profiles;

  // List profiles if requested
  if (options.listProfiles) {
    listProfiles(profiles);
    return;
  }

  // Validate arguments
  validateArgs(options);

  console.log('🚢 SeaRoutes Graph Generator\n');
  console.log(`Input:  ${options.inputFile}`);
  console.log(`Debug:  ${options.debugMode ? 'enabled' : 'disabled'}\n`);

  console.time('⏱️  Total generation time');

  try {
    if (options.allProfiles) {
      // Generate graphs for all available profiles
      console.log('🔄 Generating graphs for all profiles...\n');

      const results = [];

      // Generate basic graph
      console.log('📊 Generating basic graph...');
      const basicResult = await generateGraph({ ...options, profile: 'basic' }, helpers);
      results.push({ profile: 'basic', output: basicResult });
      console.log('');

      // Generate graphs for all maritime profiles
      if (profiles && profiles.classes) {
        const classes = Object.keys(profiles.classes);
        for (const className of classes) {
          console.log(`📊 Generating graph for profile: ${className}...`);
          try {
            const result = await generateGraph({ ...options, profile: className }, helpers);
            results.push({ profile: className, output: result });
          } catch (error) {
            console.error(`❌ Failed to generate graph for ${className}: ${error.message}`);
          }
          console.log('');
        }
      }

      console.timeEnd('⏱️  Total generation time');
      console.log('\n📋 Generated Graphs Summary:');
      for (const result of results) {
        console.log(`  ${result.profile.padEnd(12)} → ${result.output}`);
      }
      console.log('\n🎉 All graphs generated successfully!');

    } else {
      // Generate single graph for specified profile
      if (options.profile !== 'basic' && profiles && profiles.classes) {
        const classes = Object.keys(profiles.classes);
        if (!classes.includes(options.profile)) {
          console.error(`❌ Error: Profile '${options.profile}' not found.`);
          console.log(`Available profiles: basic, ${classes.join(', ')}`);
          process.exit(1);
        }
      }

      const outputFile = await generateGraph(options, helpers);

      console.timeEnd('⏱️  Total generation time');
      console.log(`\nProfile: ${options.profile}`);
      console.log(`Output:  ${outputFile}`);
      console.log('\n🎉 Graph generation completed successfully!');
    }

  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    if (options.debugMode) {
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

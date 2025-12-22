#!/usr/bin/env node

import { Graph } from 'contraction-hierarchy-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, basename, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import length from '@turf/length';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * CLI script to generate Contraction Hierarchy graph from GeoJSON network
 * Usage: node scripts/generate-graph.js <input-file> [output-file]
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
    process.exit(1);
  }

  const inputFile = args[2];
  if (!existsSync(inputFile)) {
    console.error(`❌ Error: Input file '${inputFile}' does not exist\n`);
    process.exit(1);
  }

  if (extname(inputFile).toLowerCase() !== '.geojson') {
    console.warn(`⚠️  Warning: Input file '${inputFile}' is not a .geojson file`);
  }

  return inputFile;
}

function generateOutputPath(inputFile, customOutput) {
  if (customOutput) {
    return customOutput;
  }

  const baseName = basename(inputFile, extname(inputFile));
  return `${baseName}.pbf`;
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

function buildGraph(network, debugMode = false) {
  console.log('🏗️  Building Contraction Hierarchy graph...');

  console.time('⏱️  Graph construction');
  const graph = new Graph(network, { debugMode });
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
    console.time('⏱️  Saving PBF');
    graph.savePbfCH(outputFile);
    console.timeEnd('⏱️  Saving PBF');

    // Check file size
    const stats = readFileSync(outputFile);
    const sizeMB = (stats.length / 1024 / 1024).toFixed(2);

    console.log(`✅ Graph saved successfully (${sizeMB} MB)`);
  } catch (error) {
    console.error(`❌ Error saving graph: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv;

  // Show help if requested
  if (args.includes('-h') || args.includes('--help')) {
    showHelp();
    return;
  }

  // Import dependencies
  const { triplicateGeoJSON } = await importDependencies();

  // Validate arguments
  const inputFile = validateArgs(args);
  const outputFile = generateOutputPath(inputFile, args[3]);
  const debugMode = args.includes('--debug') || args.includes('-d');

  console.log('🚢 SeaRoutes Graph Generator\n');
  console.log(`Input:  ${inputFile}`);
  console.log(`Output: ${outputFile}`);
  console.log(`Debug:  ${debugMode ? 'enabled' : 'disabled'}\n`);

  console.time('⏱️  Total generation time');

  try {
    // Load and preprocess network
    const network = loadNetwork(inputFile);
    const processedNetwork = preprocessNetwork(network, triplicateGeoJSON);

    // Build graph
    const graph = buildGraph(processedNetwork, debugMode);

    // Save graph
    saveGraph(graph, outputFile);

    console.timeEnd('⏱️  Total generation time');
    console.log('\n🎉 Graph generation completed successfully!');

  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    if (debugMode) {
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

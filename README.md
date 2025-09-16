# 🚢 SeaRoutes

> A modern ES6 module for maritime route calculation and pathfinding

[![npm version](https://badge.fury.io/js/searoutes.svg)](https://badge.fury.io/js/searoutes)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)

## ✨ Features

### 🗺️ Core Routing Capabilities
- **Dijkstra-based Pathfinding**: Shortest path calculation using Dijkstra's algorithm via `geojson-path-finder`
- **Spatial Index Coordinate Snapping**: High-performance coordinate snapping using Flatbush R-tree spatial index
- **Haversine Distance Calculation**: Great circle distance computation for accurate maritime distances
- **Graph-based Route Network**: GeoJSON LineString networks converted to weighted graph structures
- **Multiple Pathfinding Profiles**: Vessel-specific routing with custom weight functions and edge restrictions

### 🚢 Vessel-Specific Routing
- **Maritime Profiles**: Support for vessel class restrictions (e.g., Panamax, Suezmax)
- **Passage Restrictions**: Handle forbidden and restricted maritime passages
- **Dynamic Weight Calculation**: Configurable penalties for restricted routes
- **Multiple Vessel Classes**: Simultaneous support for different vessel types

### 🎯 Advanced Features
- **R-tree Spatial Indexing**: Flatbush-powered spatial data structure for O(log n) coordinate lookup performance
- **GeoJSON Network Triplication**: Antimeridian-aware network preprocessing for global routing capabilities
- **Coordinate Normalization**: Automatic longitude/latitude pair normalization and validation
- **Edge Weight Functions**: Dynamic weight calculation with configurable penalty multipliers for restricted passages
- **Memory-Efficient Graph Storage**: Optimized graph representation using adjacency lists and coordinate indexing

### 🔧 Developer Experience
- **Modern ES6 Modules**: Full ESM support with tree-shaking compatibility
- **TypeScript-Ready**: Comprehensive JSDoc documentation for type inference
- **Flexible APIs**: Both high-level and low-level APIs for different use cases
- **Extensive Testing**: 40+ comprehensive unit tests ensuring reliability

## 📦 Installation

```bash
npm install searoutes
```

## 🚀 Quick Start

### Basic Usage

```javascript
import { SeaRoute } from 'searoutes';

// Load your maritime network (GeoJSON FeatureCollection)
const network = await fetch('path/to/maritime-network.geojson').then(r => r.json());

// Initialize SeaRoute
const searoute = new SeaRoute(network);

// Calculate shortest route between two points
const route = searoute.getShortestRoute(
  [13.4, 52.5], // Hamburg coordinates [lng, lat]
  [2.3, 48.9],  // Paris coordinates [lng, lat]
  { 
    path: true,     // Include route geometry
    profile: 'default' // Use default routing profile
  }
);

console.log(`Distance: ${route.distance} km`);
console.log(`Distance: ${route.distanceNM} nautical miles`);
```

### Maritime Profiles Usage

```javascript
import { SeaRoute } from 'searoutes';

// Load network and maritime profiles
const network = await fetch('maritime-network.geojson').then(r => r.json());
const profiles = await fetch('maritime-profiles.json').then(r => r.json());

// Initialize with vessel-specific profiles
const searoute = new SeaRoute(network, profiles, {
  restrictedMultiplier: 1.5, // 50% penalty for restricted passages
  enableLogging: true        // Enable performance logging
});

// Calculate route for a specific vessel class
const route = searoute.getShortestRoute(
  [0, 0], [10, 10],
  { profile: 'panamax' } // Use Panamax vessel restrictions
);
```

## 🏗️ Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **[@turf/helpers](https://www.npmjs.com/package/@turf/helpers)** | ^7.2.0 | GeoJSON Point/LineString creation and geometry utilities |
| **[@turf/meta](https://www.npmjs.com/package/@turf/meta)** | ^7.2.0 | Coordinate extraction via `coordAll()` for network vertex indexing |
| **[flatbush](https://www.npmjs.com/package/flatbush)** | ^4.5.0 | High-performance R-tree spatial index for O(log n) nearest neighbor queries |
| **[geojson-antimeridian-cut](https://www.npmjs.com/package/geojson-antimeridian-cut)** | ^0.1.0 | Antimeridian crossing detection and LineString splitting |
| **[geojson-path-finder](https://www.npmjs.com/package/geojson-path-finder)** | ^2.0.2 | Dijkstra's algorithm implementation for weighted graph pathfinding |

## ⚙️ Technical Architecture

### Algorithms & Data Structures

#### Pathfinding Engine
- **Algorithm**: Dijkstra's shortest path algorithm
- **Implementation**: Via `geojson-path-finder` with custom weight functions
- **Graph Structure**: Adjacency list representation of GeoJSON LineString networks
- **Weight Function**: Haversine distance calculation with vessel-specific penalties

#### Spatial Indexing
- **Data Structure**: R-tree spatial index (Flatbush implementation)
- **Performance**: O(log n) nearest neighbor queries
- **Coordinate Storage**: Packed binary format for memory efficiency
- **Query Types**: Point-in-polygon, nearest vertex, range queries

#### Network Preprocessing
- **Triplication**: GeoJSON network copied 3x for antimeridian handling
- **Coordinate Extraction**: All vertices extracted using `@turf/meta.coordAll()`
- **Index Building**: Spatial index constructed from vertex coordinates
- **Graph Construction**: LineString features converted to weighted edges

### Development Dependencies

| Package | Purpose |
|---------|---------|
| **eslint** | Code linting and style enforcement |
| **mocha** | Test framework |
| **chai** | Assertion library for tests |
| **c8** | Code coverage reporting |
| **rollup** | Module bundling for distribution |

## 📚 API Reference

### SeaRoute Class

#### Constructor
```javascript
new SeaRoute(network, maritimeProfiles, options)
```

**Parameters:**
- `network` (Object): GeoJSON FeatureCollection containing maritime routes
- `maritimeProfiles` (Object, optional): Maritime vessel class configurations
- `options` (Object, optional): Configuration options
  - `tolerance` (number): Pathfinding tolerance (default: 1e-4)
  - `restrictedMultiplier` (number): Weight multiplier for restricted passages (default: 1.25)
  - `enableLogging` (boolean): Enable performance logging (default: true)

#### Methods

##### `getShortestRoute(startPoint, endPoint, options)`
Calculate shortest route between coordinates with automatic snapping to network.

**Parameters:**
- `startPoint` (Array): Start coordinates [longitude, latitude]
- `endPoint` (Array): End coordinates [longitude, latitude]
- `options` (Object, optional):
  - `profile` (string): Routing profile to use (default: 'default')
  - `path` (boolean): Include route geometry (default: false)

**Returns:** Route object with distance, geometry, and metadata

##### `getShortestPath(startPoint, endPoint, options)`
Calculate shortest path between GeoJSON points (no snapping).

##### `getPathFinder(profileName)`
Get a specific pathfinder instance for manual route calculation.

## 🔧 Configuration

### Maritime Profiles Structure

```javascript
{
  "default_policy": "allowed",
  "classes": {
    "panamax": {
      "name": "Panamax Vessels",
      "max_beam": 32.3,
      "max_length": 294.1
    }
  },
  "passages": {
    "panama_canal": {
      "feature_ids": [1001, 1002],
      "status": {
        "panamax": "allowed",
        "capesize": "forbidden"
      }
    }
  }
}
```

### Logging Options

```javascript
const searoute = new SeaRoute(network, profiles, {
  enableLogging: true,  // Enable/disable performance logging
  tolerance: 1e-4,      // Pathfinding precision
  restrictedMultiplier: 1.25 // Penalty for restricted routes
});
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🏗️ Building

```bash
# Build for production
npm run build

# Build and watch for changes
npm run build:watch

# Clean build artifacts
npm clean
```

## 📋 Requirements

- **Node.js**: >= 16.0.0
- **Package Manager**: npm or yarn
- **Module System**: ES6 modules (ESM)

## 📄 License

MIT © [Stephan Georg](https://github.com/StephanGeorg)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/StephanGeorg/searoutes/issues)
- **Documentation**: [API Docs](https://github.com/StephanGeorg/searoutes#readme)
- **Email**: s.georg@hey.com
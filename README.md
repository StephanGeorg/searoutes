# 🚢 SeaRoutes

> A modern ES6 module for maritime route calculation and pathfinding

[![npm version](https://badge.fury.io/js/searoutes.svg)](https://badge.fury.io/js/searoutes)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)

## Data Sources

SeaRoutes is built on high-quality maritime network datasets from leading institutions:

- **[Eurostat SeaRoute](https://github.com/eurostat/searoute?tab=readme-ov-file#some-additional-information) Network**: European maritime route infrastructure data
    - **[Oak Ridge National Labs](https://www.ornl.gov/)**: CTA Transportation Network Group, Global Shipping Lane Network, World (2000)
    - **AIS Data Integration**: Automatic Identification System data for real-world shipping patterns
- **Global Coverage**: Worldwide maritime route networks with regional specialization

These datasets provide comprehensive coverage of international shipping lanes, ensuring accurate pathfinding for global maritime logistics.

## Features

### Core routing capabilities
- **Dijkstra-based Pathfinding**: Shortest path calculation using Dijkstra's algorithm via `geojson-path-finder`
- **Spatial Index Coordinate Snapping**: High-performance coordinate snapping using Flatbush R-tree spatial index
- **Haversine Distance Calculation**: Great circle distance computation for accurate maritime distances
- **Graph-based Route Network**: GeoJSON LineString networks converted to weighted graph structures
- **Multiple Pathfinding Profiles**: Vessel-specific routing with custom weight functions and edge restrictions

### Vessel-specific routing
- **Maritime Profiles**: Support for vessel class restrictions (e.g., Panamax, Suezmax)
- **Passage Restrictions**: Handle forbidden and restricted maritime passages
- **Dynamic Weight Calculation**: Configurable penalties for restricted routes
- **Multiple Vessel Classes**: Simultaneous support for different vessel types

### Advanced features
- **R-tree Spatial Indexing**: Flatbush-powered spatial data structure for O(log n) coordinate lookup performance
- **GeoJSON Network Triplication**: Antimeridian-aware network preprocessing for global routing capabilities
- **Coordinate Normalization**: Automatic longitude/latitude pair normalization and validation
- **Edge Weight Functions**: Dynamic weight calculation with configurable penalty multipliers for restricted passages
- **Memory-Efficient Graph Storage**: Optimized graph representation using adjacency lists and coordinate indexing

## Installation

```bash
npm install searoutes
```

## Quick start

### Basic usage

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

### Maritime profiles usage

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

## Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **[@turf/helpers](https://www.npmjs.com/package/@turf/helpers)** | ^7.2.0 | GeoJSON Point/LineString creation and geometry utilities |
| **[@turf/meta](https://www.npmjs.com/package/@turf/meta)** | ^7.2.0 | Coordinate extraction via `coordAll()` for network vertex indexing |
| **[flatbush](https://www.npmjs.com/package/flatbush)** | ^4.5.0 | High-performance R-tree spatial index for O(log n) nearest neighbor queries |
| **[geojson-antimeridian-cut](https://www.npmjs.com/package/geojson-antimeridian-cut)** | ^0.1.0 | Antimeridian crossing detection and LineString splitting |
| **[geojson-path-finder](https://www.npmjs.com/package/geojson-path-finder)** | ^2.0.2 | Dijkstra's algorithm implementation for weighted graph pathfinding |

## Technical architecture

### Algorithms & data structures

#### Pathfinding Engine
- **Algorithm**: Dijkstra's shortest path algorithm
- **Implementation**: Via `geojson-path-finder` with custom weight functions
- **Graph Structure**: Adjacency list representation of GeoJSON LineString networks
- **Weight Function**: Haversine distance calculation with vessel-specific penalties

#### Network Preprocessing
- **Triplication**: GeoJSON network copied 3x for antimeridian handling
- **Coordinate Extraction**: All vertices extracted using `@turf/meta.coordAll()`
- **Index Building**: Spatial index constructed from vertex coordinates
- **Graph Construction**: LineString features converted to weighted edges

### Development dependencies

| Package | Purpose |
|---------|---------|
| **eslint** | Code linting and style enforcement |
| **mocha** | Test framework |
| **chai** | Assertion library for tests |
| **c8** | Code coverage reporting |
| **rollup** | Module bundling for distribution |

## API reference

### SeaRoute class

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

## Configuration

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

### Logging options

```javascript
const searoute = new SeaRoute(network, profiles, {
  enableLogging: true,  // Enable/disable performance logging
  tolerance: 1e-4,      // Pathfinding precision
  restrictedMultiplier: 1.25 // Penalty for restricted routes
});
```

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Building

```bash
# Build for production
npm run build

# Build and watch for changes
npm run build:watch

# Clean build artifacts
npm clean
```

## Requirements

- **Node.js**: >= 16.0.0
- **Package Manager**: npm or yarn
- **Module System**: ES6 modules (ESM)

## License

MIT © [Stephan Georg](https://github.com/StephanGeorg)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- **Issues**: [GitHub Issues](https://github.com/StephanGeorg/searoutes/issues)
- **Documentation**: [API Docs](https://github.com/StephanGeorg/searoutes#readme)

## 🚀 Quick Start

```javascript
import { SeaRoute } from 'searoutes';

// Use default Eurostat network with default maritime profiles
const route = new SeaRoute();

// Calculate shortest route between two points
const result = route.getShortestRoute(
  [-74.0059, 40.7128],  // New York
  [139.6917, 35.6895],  // Tokyo
  { path: true }
);

console.log(`Distance: ${result.distanceNM} nautical miles`);
```

### Using Vessel-Specific Profiles

The library includes a default maritime profile for Panamax vessels with passage restrictions:

```javascript
const route = new SeaRoute();

// Route for Panamax vessel (default profile)
const panamaxRoute = route.getShortestRoute(
  [-74.0059, 40.7128],  // New York
  [2.3522, 48.8566],     // Paris
  { 
    profile: 'panamax',
    path: true 
  }
);

console.log(`Panamax: ${panamaxRoute.distanceNM} NM`);
```

### Using ORNL Network

```javascript
const route = new SeaRoute({
  defaultNetwork: 'ornl'
});
```

### With Custom Network

```javascript
import customNetwork from './my-network.geojson';

const route = new SeaRoute({
  network: customNetwork
});
```

### With Custom Maritime Profiles

Override the default maritime profiles with your own:

```javascript
import customProfiles from './my-custom-profiles.json';

const route = new SeaRoute({
  maritimeProfiles: customProfiles
});
```

### Complete Configuration Example

```javascript
import customNetwork from './my-network.geojson';
import customProfiles from './my-profiles.json';

const route = new SeaRoute({
  network: customNetwork,              // Optional: Custom GeoJSON network
  maritimeProfiles: customProfiles,    // Optional: Override default maritime profiles
  defaultNetwork: 'eurostat',          // Optional: 'eurostat' or 'ornl' (used if network is not provided)
  tolerance: 1e-4,                     // Optional: Pathfinding tolerance (default: 1e-4)
  restrictedMultiplier: 1.25,          // Optional: Weight multiplier for restricted passages (default: 1.25)
  enableLogging: true                  // Optional: Enable performance logging (default: false)
});
```

## 📖 API Reference

### Constructor

```javascript
new SeaRoute(options)
```

**Parameters:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `options` | `Object` | `{}` | Configuration options object |
| `options.network` | `Object` | `null` | Custom GeoJSON network (FeatureCollection). If not provided, loads default Eurostat network |
| `options.maritimeProfiles` | `Object` | `default_v1.json` | Maritime passage rules configuration. Defaults to built-in profile with Panamax vessel class |
| `options.defaultNetwork` | `String` | `'eurostat'` | Default network to load: `'eurostat'` or `'ornl'` |
| `options.tolerance` | `Number` | `1e-4` | Pathfinding tolerance for coordinate matching |
| `options.restrictedMultiplier` | `Number` | `1.25` | Weight multiplier applied to restricted passages (makes them less preferred) |
| `options.enableLogging` | `Boolean` | `false` | Enable console logging for performance monitoring |

**Example:**

```javascript
// Minimal - uses default Eurostat network and Panamax profile
const route = new SeaRoute();

// With options
const route = new SeaRoute({
  defaultNetwork: 'ornl',
  enableLogging: true,
  tolerance: 0.001
});

// With custom network and profiles
const route = new SeaRoute({
  network: myCustomNetwork,
  maritimeProfiles: myProfiles,
  restrictedMultiplier: 2.0
});
```

### Default Maritime Profile

The library includes a built-in maritime profile (`default_v1.json`) with:

- **Vessel Class**: `panamax` - Panamax vessels (≤80k DWT, ~≤12m draft)
- **Passage Restrictions**: 21 major maritime passages with status indicators
  - `allowed`: Route is permitted for the vessel class
  - `restricted`: Route is permitted but less preferred (penalty applied)
  - `forbidden`: Route is not permitted for the vessel class
- **Risk Groups**: Security, environmental, traffic, and infrastructure risks
- **Override Support**: Temporary route changes (e.g., canal closures)

**Example Passages in Default Profile:**
- Suez Canal: `forbidden` for Panamax
- Panama Canal: `allowed` for Panamax
- Malacca Strait: `allowed` for Panamax
- Gibraltar Strait: `allowed` for Panamax
- Bosphorus Strait: `allowed` for Panamax

### getShortestRoute()

Calculate the shortest maritime route between two coordinates, automatically snapping to the network.

```javascript
route.getShortestRoute(startPoint, endPoint, options)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startPoint` | `Array<number>` | Start coordinates `[longitude, latitude]` |
| `endPoint` | `Array<number>` | End coordinates `[longitude, latitude]` |
| `options` | `Object` | Route calculation options |
| `options.profile` | `String` | Profile/vessel class to use. Default profile includes: `'default'` (unrestricted), `'panamax' |
| `options.path` | `Boolean` | Include route geometry in result (default: `false`) |

**Returns:** `Object|null`

```javascript
{
  weight: 12345678,        // Path weight in meters
  distance: 12345.68,      // Distance in kilometers
  distanceNM: 6666.67,     // Distance in nautical miles
  profile: 'panamax',      // Profile used for calculation
  path: { /* GeoJSON */ }  // Route geometry (if options.path = true)
}
```

**Example:**

```javascript
const result = route.getShortestRoute(
  [-74.0059, 40.7128],     // New York
  [139.6917, 35.6895],     // Tokyo
  { 
    profile: 'panamax',    // Use Panamax vessel profile
    path: true             // Include route geometry
  }
);

console.log(`Distance: ${result.distanceNM} nautical miles`);
console.log(`Profile: ${result.profile}`);
```

### getShortestPath()

Calculate the shortest path between two GeoJSON points (no automatic snapping to network).

```javascript
route.getShortestPath(startPoint, endPoint, options)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startPoint` | `Object` | GeoJSON Point feature with `geometry.coordinates` |
| `endPoint` | `Object` | GeoJSON Point feature with `geometry.coordinates` |
| `options` | `Object` | Same as `getShortestRoute()` |

**Example:**

```javascript
const start = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-74.0059, 40.7128]
  }
};

const end = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [139.6917, 35.6895]
  }
};

const result = route.getShortestPath(start, end, { 
  profile: 'panamax',
  path: true 
});
```

## 🌐 Available Networks

### Eurostat (Default)

European maritime route infrastructure data based on AIS tracking and official shipping lanes.

```javascript
const route = new SeaRoute(); // Uses Eurostat by default
// or explicitly
const route = new SeaRoute({ defaultNetwork: 'eurostat' });
```

**Coverage**: European waters, major global shipping routes

### ORNL

Oak Ridge National Labs CTA Transportation Network Group - Global Shipping Lane Network.

```javascript
const route = new SeaRoute({ defaultNetwork: 'ornl' });
```

**Coverage**: Worldwide shipping lanes

## ⚙️ Maritime Profiles

### Built-in Default Profile (`default_v1.json`)

The library includes a realistic maritime profile with:

**Vessel Class:**
- `panamax`: Panamax vessels (≤80k DWT, ~≤12m draft)

**Major Passages (21 total):**
- **Canals**: Suez, Panama, Kiel, Corinth
- **Straits**: Malacca, Sunda, Gibraltar, Dover, Bering, Magellan, Bab el-Mandeb, Bosphorus, Dardanelles, Hormuz, Lombok, Makassar, Torres
- **Routes**: Northwest Passage, Northeast Passage, Cape of Good Hope, Cape Horn

**Risk Groups:**
- **Security**: Red Sea conflict, piracy (Gulf of Aden, Somalia), Persian Gulf tension, Black Sea conflict
- **Environmental**: Arctic ice, seasonal fog, monsoon weather
- **Traffic**: Chokepoint congestion, traffic density, pilotage requirements
- **Infrastructure**: Panama drought, Suez blockage, canal maintenance
- **Regulatory**: National restrictions, sanctions, Montreux Convention

**Override Examples:**
- Red Sea closure during conflicts
- Panama Canal restrictions during drought
- Malacca Strait congestion penalties

### Custom Profiles

You can provide your own maritime profiles configuration:

```javascript
const customProfiles = {
  version: 1,
  classes: {
    myVesselClass: "My Custom Vessel (description)"
  },
  passages: {
    suez_canal: {
      kind: "canal",
      status: {
        myVesselClass: "forbidden"
      },
      risk_group: ["red_sea_conflict"],
      feature_ids: [40019],
      notes: "Custom notes"
    }
  },
  overrides: [
    {
      id: "my_override",
      active: true,
      actions: [
        {
          type: "set_status",
          passage_id: "suez_canal",
          status: { myVesselClass: "forbidden" }
        }
      ]
    }
  ]
};

const route = new SeaRoute({
  maritimeProfiles: customProfiles
});

// Use custom profile
const result = route.getShortestRoute(
  [0, 0], 
  [10, 10], 
  { profile: 'myVesselClass' }
);
```

### Profile Format

```json
{
  "version": 1,
  "updated": "2025-09-10",
  "classes": {
    "vessel_class_name": "Human-readable description"
  },
  "default_policy": "allowed|restricted|forbidden",
  "risk_groups": {
    "risk_id": "Description of risk"
  },
  "passages": {
    "passage_id": {
      "kind": "canal|strait|route",
      "status": {
        "vessel_class_name": "allowed|restricted|forbidden"
      },
      "risk_group": ["risk_id1", "risk_id2"],
      "feature_ids": [12345],
      "notes": "Additional information"
    }
  },
  "overrides": [
    {
      "id": "override_id",
      "description": "What this override does",
      "active": true,
      "window": { "start": "2025-01-01", "end": "2025-03-31" },
      "actions": [
        {
          "type": "set_status",
          "passage_id": "passage_id",
          "status": {
            "vessel_class_name": "forbidden"
          }
        }
      ]
    }
  ]
}
```